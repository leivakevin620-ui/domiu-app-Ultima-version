'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface BottomNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
}

interface BottomNavigationProps {
  items: BottomNavItem[];
  className?: string;
}

export function BottomNavigation({ items, className }: BottomNavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/80 backdrop-blur-xl lg:hidden',
        className,
      )}
    >
      <div className="flex h-16 items-center justify-around px-2">
        {items.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors relative',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/80',
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center">
                {isActive && item.activeIcon ? item.activeIcon : item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
