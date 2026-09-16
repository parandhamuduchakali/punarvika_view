/**
 * Types mirroring the punarvika_core API contract.
 *
 * Money is `string`, never `number`. The API sends Decimals serialised as
 * strings ("70.00") precisely because binary floating point cannot represent
 * them; parsing them into `number` here would reintroduce the rounding error the
 * backend went to trouble to avoid. Prices are displayed as sent and are never
 * arithmetic on the client -- every total comes from the server.
 */

// --------------------------------------------------------------- envelope
export interface ApiErrorDetail {
  code: string;
  message: string;
  /** Field name -> messages, for binding to reactive form controls. */
  fields?: Record<string, string[]>;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface MessageResponse {
  success: boolean;
  message: string;
}

// ------------------------------------------------------------------- auth
export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// -------------------------------------------------------------- addresses
export interface Address {
  id: number;
  contact_name: string;
  contact_phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

export type AddressPayload = Omit<Address, 'id'>;

// ---------------------------------------------------------------- catalog
export type ProductUnit = 'LITRE' | 'KG' | 'GRAM' | 'PIECE' | 'DOZEN' | 'PACKET';
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  description: string | null;
  image_url: string | null;
  display_order: number;
}

export interface CategoryTree extends Category {
  children: Category[];
}

export interface ProductSummary {
  id: number;
  name: string;
  slug: string;
  short_description: string | null;
  price: string;
  unit: ProductUnit;
  image_url: string | null;
  category_id: number;
  is_available: boolean;
  /** A status, not a number -- the API never publishes stock levels. */
  stock_status: StockStatus;
  /** Averaged over approved reviews only; null until there are any. */
  rating_average: number | null;
  rating_count: number;
}

export interface ProductImage {
  id: number;
  image_url: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  sku: string;
  minimum_order_quantity: string;
  maximum_order_quantity: string | null;
  images: ProductImage[];
  category: Category | null;
  price_display: string;
}

export interface AdminProductImage extends ProductImage {
  product_id: number;
}

export interface ProductImagePayload {
  image_url: string;
  alt_text?: string | null;
  display_order?: number;
  is_primary?: boolean;
}

export interface AuditEntry {
  id: number;
  /** Null when the account that acted has since been deleted. */
  user_id: number | null;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// ---------------------------------------------------------------- reviews
export interface Review {
  id: number;
  product_id: number;
  rating: number;
  title: string | null;
  body: string | null;
  /** First name only -- the API never publishes the email or surname. */
  author: string;
  is_approved: boolean;
  created_at: string;
}

export interface MyReview extends Review {
  product_name: string;
}

export interface AdminReview extends Review {
  user_id: number;
  product_name: string;
  order_id: number | null;
  moderation_note: string | null;
}

export interface RatingSummary {
  average: number | null;
  count: number;
}

export interface ReviewPayload {
  rating: number;
  title?: string | null;
  body?: string | null;
}

// ---------------------------------------------------------------- coupons
export type DiscountType = 'PERCENT' | 'FLAT';

export interface AdminCoupon {
  id: number;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  value: string;
  max_discount_amount: string | null;
  minimum_order_value: string;
  usage_limit: number;
  per_customer_limit: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  times_redeemed: number;
}

export interface ProductQuery {
  q?: string;
  category?: string;
  min_price?: string;
  max_price?: string;
  available_only?: boolean;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
}

// ------------------------------------------------------------------- cart
export interface PriceBreakdown {
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  delivery_charge: string;
  total_amount: string;
  currency: string;
}

export interface CartItem {
  id: number;
  product_id: number;
  product_name: string;
  product_slug: string;
  image_url: string | null;
  unit: ProductUnit;
  unit_price: string;
  quantity: string;
  line_total: string;
  stock_status: StockStatus;
  minimum_order_quantity: string;
  maximum_order_quantity: string | null;
  /** Non-null when this line cannot be ordered as it stands. */
  issue: string | null;
}

export interface Cart {
  items: CartItem[];
  pricing: PriceBreakdown;
  item_count: number;
  has_issues: boolean;
  /** The coupon the server accepted, which may differ in case from what was typed. */
  coupon_code: string | null;
  /** Why a supplied coupon could not be applied. The cart still renders. */
  coupon_error: string | null;
}

// ----------------------------------------------------------------- orders
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_PROCESSING'
  | 'PAID'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  unit: ProductUnit;
  unit_price: string;
  quantity: string;
  line_total: string;
}

export interface DeliveryAddressSnapshot {
  contact_name: string;
  contact_phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderSummary {
  id: number;
  order_number: string;
  status: OrderStatus;
  total_amount: string;
  currency: string;
  item_count: number;
  placed_at: string | null;
  created_at: string;
}

export interface OrderDetail extends OrderSummary {
  coupon_code: string | null;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  delivery_charge: string;
  items: OrderItem[];
  delivery_address: DeliveryAddressSnapshot;
  notes: string | null;
  cancellation_reason: string | null;
  confirmed_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  can_cancel: boolean;
}

// --------------------------------------------------------------- payments
/** UPI and card only. The API rejects anything else. */
export type PaymentMethod = 'UPI' | 'CARD';

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED';

export interface Payment {
  id: number;
  order_id: number;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  amount: string;
  currency: string;
  gateway: string;
  gateway_order_id: string;
  expires_at: string | null;
  paid_at: string | null;
  failure_message: string | null;
  /** The gateway's *public* key id. The secret never leaves the server. */
  public_key: string | null;
}

export interface PaymentResult {
  success: boolean;
  order_id: number;
  order_number: string;
  order_status: string;
  payment: Payment;
}

// ------------------------------------------------------------------ admin
export interface AdminProduct {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  short_description: string | null;
  price: string;
  unit: ProductUnit;
  minimum_order_quantity: string;
  maximum_order_quantity: string | null;
  image_url: string | null;
  is_available: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminCategory extends Category {
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  product_id: number;
  product_name: string;
  stock_quantity: string;
  reserved_quantity: string;
  available_quantity: string;
  low_stock_threshold: string;
  is_low: boolean;
  batch: string | null;
  expiry_date: string | null;
}

export interface LowStockItem {
  product_id: number;
  product_name: string;
  available_quantity: string;
  low_stock_threshold: string;
}

export interface AdminCustomer {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AdminPayment {
  id: number;
  order_id: number;
  payment_method: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  gateway: string;
  gateway_order_id: string;
  gateway_payment_id: string | null;
  failure_code: string | null;
  attempt_count: number;
  paid_at: string | null;
  created_at: string;
}

export interface SalesReport {
  orders_total: number;
  orders_paid: number;
  orders_cancelled: number;
  revenue: string;
  currency: string;
  average_order_value: string;
  by_status: Record<string, number>;
}
