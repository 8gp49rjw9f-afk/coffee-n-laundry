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
