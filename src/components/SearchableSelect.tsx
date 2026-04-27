import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchableOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: (string | SearchableOption)[];
  placeholder?: string;
  searchPlaceholder?: string;
}

export function SearchableSelect({ 
  value, 
  onValueChange, 
  options, 
  placeholder = "Select option",
  searchPlaceholder = "Search..."
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      return opt;
    });
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!search) return normalizedOptions;
    const lowerSearch = search.toLowerCase();
    return normalizedOptions.filter(opt => 
      opt.label.toLowerCase().includes(lowerSearch) || 
      opt.value.toLowerCase().includes(lowerSearch) ||
      (opt.description && opt.description.toLowerCase().includes(lowerSearch))
    );
  }, [normalizedOptions, search]);

  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full min-h-12 h-auto px-4 py-3 justify-between font-normal bg-white border-slate-200 hover:bg-slate-50 transition-all text-left",
          !value && "text-slate-500"
        )}
      >
        <span className="leading-snug truncate max-w-[90%]">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="absolute z-[100] w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 min-w-[300px]">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                autoFocus
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOpen(false);
                }}
                className="pl-10 h-10 bg-white border-slate-200 focus:ring-[#ccaa49] text-sm"
              />
              {search && (
                <button 
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          
          <div className="max-h-[450px] overflow-y-auto pt-1 pb-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onValueChange(option.value);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 text-sm hover:bg-[#123765]/5 transition-colors flex flex-col gap-1 group",
                    value === option.value ? "bg-[#123765]/5 text-[#123765] font-semibold" : "text-slate-600 font-medium"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="leading-snug">{option.label}</span>
                    {value === option.value && <Check className="h-4 w-4 text-[#ccaa49] shrink-0" />}
                  </div>
                  {option.description && (
                    <span className="text-[10px] text-slate-400 font-normal leading-relaxed line-clamp-2">
                      {option.description}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="py-8 px-4 text-center text-slate-400 text-sm italic">
                No matching results found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

