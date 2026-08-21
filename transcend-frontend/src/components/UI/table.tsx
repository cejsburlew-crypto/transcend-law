// Table primitives. See ui/card.tsx for why these exist.

import React from 'react';

const join = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' ');

export const Table = ({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <table className={join('ui-table', className)} {...props} />
);

export const TableHeader = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...props} />;
export const TableBody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props} />;
export const TableFooter = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <tfoot {...props} />;
export const TableRow = (props: React.HTMLAttributes<HTMLTableRowElement>) => <tr {...props} />;

export const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th scope="col" className={join('ui-table-head', className)} {...props} />
);

export const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={join('ui-table-cell', className)} {...props} />
);

export const TableCaption = (props: React.HTMLAttributes<HTMLTableCaptionElement>) => <caption {...props} />;
