'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Search, Download, ChevronDown } from 'lucide-react';

export interface EnterpriseColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  exportable?: boolean;
}

export interface EnterpriseTableProps<T> {
  columns: EnterpriseColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
  title?: string;
  exportable?: boolean;
  exportFilename?: string;
  actions?: React.ReactNode;
}

export function EnterpriseTable<T = Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  searchable,
  searchPlaceholder = 'Buscar...',
  searchValue,
  onSearchChange,
  onRowClick,
  emptyMessage = 'No hay datos disponibles',
  loading,
  className,
  title,
  exportable,
  exportFilename = 'export',
  actions,
}: EnterpriseTableProps<T>) {
  const [localQuery, setLocalQuery] = React.useState('');
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const query = searchValue !== undefined ? searchValue : localQuery;
  const setQuery = onSearchChange || setLocalQuery;

  const filtered = React.useMemo(() => {
    if (!query) return data;
    const q = query.toLowerCase();
    return data.filter((item: T) =>
      columns.some((col) => {
        const val = (item as Record<string, unknown>)[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      }),
    );
  }, [data, query, columns]);

  const sorted = React.useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a: T, b: T) => {
      const aVal = String((a as Record<string, unknown>)[sortKey!] ?? '');
      const bVal = String((b as Record<string, unknown>)[sortKey!] ?? '');
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleExport = () => {
    const exportCols = columns.filter((c) => c.exportable !== false);
    const headers = exportCols.map((c) => c.header).join(',');
    const rows = data.map((item: T) =>
      exportCols.map((col) => {
        const val = (item as Record<string, unknown>)[col.key];
        const str = val != null ? String(val) : '';
        return str.includes(',') ? `"${str}"` : str;
      }).join(','),
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFilename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('rounded-2xl border border-border bg-card shadow-card overflow-hidden', className)}>
      {(searchable || title || exportable || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3">
          <div className="flex items-center gap-3">
            {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
            {searchable && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 w-56 rounded-xl border border-border bg-background/50 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 transition-all duration-200 focus:w-72"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {exportable && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground hover:bg-primary/5"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </button>
            )}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                    col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors',
                    col.className,
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <ChevronDown
                        className={cn('h-3 w-3 transition-transform', sortDir === 'desc' && 'rotate-180')}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 w-3/4 animate-pulse rounded-md bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-muted p-3">
                      <Search className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              (sorted as T[]).map((item) => (
                <tr
                  key={keyExtractor(item)}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    'transition-colors hover:bg-muted/30 group',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 text-sm text-foreground', col.className)}>
                      {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
