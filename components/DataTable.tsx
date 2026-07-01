'use client';

import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { Search, ChevronLeft, ChevronRight, X } from './AppIcons';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  globalSearchPlaceholder?: string;
  className?: string;
  rowClassName?: (row: TData) => string;
  onRowClick?: (row: TData) => void;
  hidePagination?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  globalSearchPlaceholder = 'Search...',
  className = '',
  rowClassName,
  onRowClick,
  hidePagination = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // Increase default page size
    initialState: {
      pagination: {
        pageSize: 50,
      },
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={globalSearchPlaceholder}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className={`overflow-x-auto bg-white rounded-3xl border border-slate-100 shadow-sm ${className}`}>
        <table className="w-full text-left">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {headerGroup.headers.map((header) => {
                  return (
                    <th key={header.id} className="px-6 py-4">
                      {header.isPlaceholder ? null : (
                        <div className="flex flex-col gap-2">
                          <div
                            className={`flex items-center gap-1 ${
                              header.column.getCanSort() ? 'cursor-pointer select-none hover:text-slate-600 transition-colors' : ''
                            }`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {{
                              asc: <span className="text-blue-500 text-[8px]">▲</span>,
                              desc: <span className="text-blue-500 text-[8px]">▼</span>,
                            }[header.column.getIsSorted() as string] ?? (header.column.getCanSort() ? <span className="text-slate-300 text-[8px]">⇅</span> : null)}
                          </div>
                          {header.column.getCanFilter() ? (
                            <div className="mt-1">
                              <Filter column={header.column} />
                            </div>
                          ) : null}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-50">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const isClickable = !!onRowClick;
                const customClass = rowClassName ? rowClassName(row.original) : '';
                return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick && onRowClick(row.original)}
                    className={`transition-colors ${isClickable ? 'cursor-pointer hover:bg-slate-50/50' : 'hover:bg-slate-50/30'} ${customClass}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400 font-bold">
                  No results found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {!hidePagination && table.getPageCount() > 1 && (
          <div className="p-4 border-t border-slate-50 flex items-center justify-between text-sm font-bold text-slate-500">
            <div>
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Filter({ column }: { column: any }) {
  const columnFilterValue = column.getFilterValue();
  
  return (
    <input
      type="text"
      value={(columnFilterValue ?? '') as string}
      onChange={(e) => column.setFilterValue(e.target.value)}
      placeholder={`Filter...`}
      onClick={(e) => e.stopPropagation()}
      className="w-full px-2 py-1 text-xs border border-slate-200 rounded outline-none focus:border-blue-500 font-medium normal-case tracking-normal bg-white text-slate-800"
    />
  );
}
