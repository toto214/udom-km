/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  image: string | null;
}

export interface Customer {
  id: number | null;
  name: string;
  phone: string;
  address?: string;
  moo?: string;
}

export interface OrderItem {
  product: {
    name: string;
    price: number;
  };
  quantity: number;
}

export interface Order {
  id: string;
  customer: Customer;
  total: number;
  status: 'Paid' | 'Unpaid' | 'Cancelled';
  date: string;
  items: OrderItem[];
}

export interface StockHistory {
  id: string;
  productId: number;
  change: number;
  reason: string;
  user: string;
  timestamp: string;
}
