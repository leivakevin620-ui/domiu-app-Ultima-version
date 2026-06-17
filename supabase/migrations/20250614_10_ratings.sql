-- Migration: 20250614_10_ratings.sql
-- Description: Create ratings and reviews tables

-- Create ratings table
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  rater_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rated_entity_id UUID NOT NULL, -- can be business_id, driver_id, or product_id
  rating_type rating_type NOT NULL,
  rating DECIMAL(2, 1) NOT NULL, -- 1.0 to 5.0
  title VARCHAR(255),
  review TEXT,
  images TEXT[], -- Array of image URLs
  helpful_count INT DEFAULT 0,
  unhelpful_count INT DEFAULT 0,
  verified_purchase BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  response TEXT, -- Merchant response to review
  response_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  response_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for ratings
CREATE INDEX idx_ratings_order_id ON ratings(order_id);
CREATE INDEX idx_ratings_rater_id ON ratings(rater_id);
CREATE INDEX idx_ratings_rated_entity_id ON ratings(rated_entity_id);
CREATE INDEX idx_ratings_rating_type ON ratings(rating_type);
CREATE INDEX idx_ratings_rating ON ratings(rating DESC);
CREATE INDEX idx_ratings_is_public ON ratings(is_public);
CREATE INDEX idx_ratings_created_at ON ratings(created_at DESC);
CREATE INDEX idx_ratings_deleted_at ON ratings(deleted_at);
CREATE INDEX idx_ratings_entity_type ON ratings(rating_type, rated_entity_id, is_public);

-- Create rating comments table
CREATE TABLE rating_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rating_comments_rating_id ON rating_comments(rating_id);
CREATE INDEX idx_rating_comments_author_id ON rating_comments(author_id);

-- Create rating reactions table
CREATE TABLE rating_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type VARCHAR(50), -- 'helpful', 'unhelpful'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(rating_id, user_id, reaction_type)
);

CREATE INDEX idx_rating_reactions_rating_id ON rating_reactions(rating_id);
CREATE INDEX idx_rating_reactions_user_id ON rating_reactions(user_id);

-- Triggers for updated_at
CREATE TRIGGER update_ratings_updated_at
BEFORE UPDATE ON ratings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rating_comments_updated_at
BEFORE UPDATE ON rating_comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate business rating
CREATE OR REPLACE FUNCTION recalculate_business_rating(p_business_id UUID)
RETURNS VOID AS $$
DECLARE
  v_avg_rating DECIMAL(2, 1);
  v_total_ratings INT;
BEGIN
  SELECT 
    ROUND(AVG(r.rating), 1),
    COUNT(r.id)
  INTO v_avg_rating, v_total_ratings
  FROM ratings r
  WHERE r.rated_entity_id = p_business_id 
    AND r.rating_type = 'merchant'
    AND r.is_public = TRUE
    AND r.deleted_at IS NULL;

  UPDATE businesses
  SET 
    rating = COALESCE(v_avg_rating, 0),
    total_ratings = COALESCE(v_total_ratings, 0)
  WHERE id = p_business_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate driver rating
CREATE OR REPLACE FUNCTION recalculate_driver_rating(p_driver_id UUID)
RETURNS VOID AS $$
DECLARE
  v_avg_rating DECIMAL(3, 2);
  v_total_ratings INT;
BEGIN
  SELECT 
    ROUND(AVG(r.rating), 2),
    COUNT(r.id)
  INTO v_avg_rating, v_total_ratings
  FROM ratings r
  WHERE r.rated_entity_id = p_driver_id 
    AND r.rating_type = 'courier'
    AND r.is_public = TRUE
    AND r.deleted_at IS NULL;

  UPDATE drivers
  SET 
    rating = COALESCE(v_avg_rating, 0),
    total_ratings = COALESCE(v_total_ratings, 0),
    avg_rating = COALESCE(v_avg_rating, 0)
  WHERE id = p_driver_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate product rating
CREATE OR REPLACE FUNCTION recalculate_product_rating(p_product_id UUID)
RETURNS VOID AS $$
DECLARE
  v_avg_rating DECIMAL(2, 1);
  v_total_ratings INT;
BEGIN
  SELECT 
    ROUND(AVG(r.rating), 1),
    COUNT(r.id)
  INTO v_avg_rating, v_total_ratings
  FROM ratings r
  WHERE r.rated_entity_id = p_product_id 
    AND r.rating_type = 'order'
    AND r.is_public = TRUE
    AND r.deleted_at IS NULL;

  UPDATE products
  SET 
    rating = COALESCE(v_avg_rating, 0),
    total_ratings = COALESCE(v_total_ratings, 0)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate ratings on insert/update
CREATE OR REPLACE FUNCTION trigger_recalculate_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rating_type = 'merchant' THEN
    PERFORM recalculate_business_rating(NEW.rated_entity_id);
  ELSIF NEW.rating_type = 'courier' THEN
    PERFORM recalculate_driver_rating(NEW.rated_entity_id);
  ELSIF NEW.rating_type = 'order' THEN
    PERFORM recalculate_product_rating(NEW.rated_entity_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_rating_on_insert
AFTER INSERT ON ratings
FOR EACH ROW
WHEN (NEW.is_public = TRUE)
EXECUTE FUNCTION trigger_recalculate_rating();

CREATE TRIGGER recalculate_rating_on_update
AFTER UPDATE ON ratings
FOR EACH ROW
WHEN (NEW.is_public = TRUE OR OLD.is_public = TRUE)
EXECUTE FUNCTION trigger_recalculate_rating();

-- Function to update order rating
CREATE OR REPLACE FUNCTION update_order_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders
  SET 
    rating_by_customer = NEW.rating,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.order_id
    AND NEW.rating_type = 'order';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_rating_trigger
AFTER INSERT ON ratings
FOR EACH ROW
EXECUTE FUNCTION update_order_rating();
