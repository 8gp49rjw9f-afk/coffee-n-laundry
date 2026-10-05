/* ====================================================== */
/* TYPES — coffee'n'laundry domain                          */
/* ====================================================== */

export type PlaceType = "coffee" | "laundry";
export type CoffeeKind = "barista" | "regular" | "both";
export type PriceKind =
  | "wash"
  | "dryer"
  | "wash_fold"
  | "service"
  | "espresso"
  | "filter"
  | "flat_white"
  | "detergent";
export type FoodKind = "full_meals" | "vegan" | "sandwich" | "pastries";
export type PhotoType = "exterior" | "interior" | "machines" | "prices" | "detail";
export type UpdateType =
  | "price"
  | "payment_method"
  | "hours"
  | "detergent"
  | "coffee"
  | "photo"
  | "closed"
  | "moved"
  | "general";
export type PlaceStatus = "active" | "closed" | "unverified";

export interface Place {
  id: string;
  place_type: PlaceType;

  name: string;
  description: string | null;
  address: string | null;

  latitude: number;
  longitude: number;

  city: string | null;
  country: string | null;
  country_code: string | null;

  website: string | null;
  phone: string | null;
  opening_hours: unknown | null;

  has_wifi: boolean | null;
  has_power: boolean | null;
  has_parking: boolean | null;
  has_seating: boolean | null;
  has_toilets: boolean | null;

  accepted_payments: string[];

  status: PlaceStatus;

  created_by: string | null;
  created_at: string;
  updated_at: string;

  /* joined for rendering */
  coffee?: CoffeeDetails | null;
  laundry?: LaundryDetails | null;
  prices?: Price[];
}

/*
 * One object, not two. A second declaration of this same interface
 * used to sit further down the file; TypeScript merged them, which
 * hides a real divergence instead of reporting it.
 */
export interface PlaceWithFreshness extends Place {
  last_verified_at: string | null;
  confirmations_count: number;
  updates_count: number;
  photos_count: number;

  /* exposed by the view so the map panel needs no extra query */
  primary_photo_path: string | null;
  last_verifier: string | null;
  latest_note: string | null;

  wash_amount: number | null;
  wash_currency: string | null;
  dryer_amount: number | null;
  dryer_currency: string | null;

  coffee_kind: string | null;
  ambience: string[] | null;
  sells_beans: boolean | null;

  wash_minutes: number | null;
  dryer_minutes: number | null;
  last_entry_minutes: number | null;
  detergent_included: boolean | null;

  /* computed client-side when a distance was asked for */
  distance_km?: number | null;
}

export interface CoffeeDetails {
  place_id: string;
  coffee_kind: CoffeeKind;
  roaster: string | null;
  brew_methods: string[];
  has_decaf: boolean | null;

  /*
   * `has_plant_milk` has no writer and no reader — a leftover from
   * before the milks were listed one by one. Kept rather than removed
   * because dropping a column is a migration, and this one costs
   * nothing sitting here. If it ever gets a writer, it should mean
   * "any plant milk at all", which is a fair summary line.
   */
  has_plant_milk: boolean | null;

  notes: string | null;

  laptop_friendly: boolean | null;
  sells_beans: boolean | null;
  has_roaster: boolean | null;

  /*
   * Cow milk, beside the alternatives — not above them. A café that
   * pours dairy and a café that pours oat are both worth knowing
   * about, and neither is the default assumption any more.
   */
  has_milk: boolean | null;
  has_oat_milk: boolean | null;
  has_soy_milk: boolean | null;
  has_coconut_milk: boolean | null;
  has_almond_milk: boolean | null;
  ambience: string[];

  /* what it serves besides coffee: full_meals, vegan, sandwich, pastries */
  food: string[];
}

export interface LaundryDetails {
  place_id: string;
  machine_sizes: string[];
  machine_count: number | null;
  detergent_included: boolean | null;
  detergent_purchasable: boolean | null;
  self_service: boolean | null;
  attended: boolean | null;
  drying_available: "dryer" | "line" | "both" | "none" | null;
  has_change_machine: boolean | null;
  typical_duration_minutes: number | null;
  notes: string | null;

  has_seating: boolean | null;
  open_24h: boolean;
  wash_minutes: number | null;
  dryer_minutes: number | null;
  last_entry_minutes: number | null;
}


export interface Price {
  id: string;
  place_id: string;
  kind: PriceKind;
  label: string | null;
  amount: number;
  currency: string;
  machine_size: string | null;
  created_at: string;
}

export interface PlacePhoto {
  id: string;
  place_id: string;
  uploaded_by: string | null;
  storage_path: string;
  photo_type: PhotoType;
  caption: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface PlaceUpdate {
  id: string;
  place_id: string;
  user_id: string | null;
  update_type: UpdateType;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  comment: string | null;
  photo_id: string | null;
  created_at: string;
}

export interface PlaceConfirmation {
  id: string;
  place_id: string;
  user_id: string;
  comment: string | null;
  created_at: string;
}

/* Map filters */
export interface MapFilters {
  type: "all" | PlaceType;
  openNow: boolean;
  wifi: boolean;
  power: boolean;
  parking: boolean;
  coffeeKind: CoffeeKind | "any";
  payments: string[];
}

export const DEFAULT_FILTERS: MapFilters = {
  type: "all",
  openNow: false,
  wifi: false,
  power: false,
  parking: false,
  coffeeKind: "any",
  payments: [],
};
