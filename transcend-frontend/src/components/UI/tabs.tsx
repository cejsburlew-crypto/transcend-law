// Tabs primitives.
//
// Context-driven so <TabsTrigger> and <TabsContent> coordinate without the call
// sites wiring state themselves - matching the shadcn API the components were
// written against. See ui/card.tsx for why these exist.

import React, { createContext, useContext, useState } from 'react';

const join = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' ');

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabs = (component: string): TabsContextValue => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${component}> must be rendered inside <Tabs>`);
  return ctx;
};

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const Tabs = ({ defaultValue = '', value, onValueChange, className, children, ...props }: TabsProps) => {
  const [internal, setInternal] = useState(defaultValue);
  // Controlled when `value` is supplied, uncontrolled otherwise.
  const active = value ?? internal;

  const setValue = (next: string) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ value: active, setValue }}>
      <div className={join('ui-tabs', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div role="tablist" className={join('ui-tabs-list', className)} {...props} />
);

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = ({ value, className, onClick, ...props }: TabsTriggerProps) => {
  const tabs = useTabs('TabsTrigger');
  const selected = tabs.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      data-state={selected ? 'active' : 'inactive'}
      className={join('ui-tabs-trigger', selected ? 'is-active' : undefined, className)}
      onClick={(e) => {
        tabs.setValue(value);
        onClick?.(e);
      }}
      {...props}
    />
  );
};

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = ({ value, className, ...props }: TabsContentProps) => {
  const tabs = useTabs('TabsContent');
  if (tabs.value !== value) return null;
  return <div role="tabpanel" className={join('ui-tabs-content', className)} {...props} />;
};
