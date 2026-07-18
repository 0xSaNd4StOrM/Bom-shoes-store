-- Add products.brand to the storefront catalog view so the storefront can
-- display and filter by brand. Appended as the last column so CREATE OR
-- REPLACE accepts it without a drop (the app selects * so order is irrelevant).
create or replace view public.product_catalog as
 SELECT p.id,
    p.name,
    p.slug,
    p.description,
    p.price,
    p.category,
    p.image_url,
    p.stock,
    p.sizes,
    p.colors,
    p.featured,
    p.created_at,
    p.sale_price,
    p.materials,
    p.weight_grams,
    p.tags,
    p.search_vector,
    COALESCE(v.total_stock, 0::bigint) AS total_stock,
    COALESCE(v.available_sizes, '{}'::text[]) AS available_sizes,
    COALESCE(v.available_colors, '{}'::text[]) AS available_colors,
    COALESCE(v.min_price, p.price) AS min_price,
    r.avg_rating,
    COALESCE(r.review_count, 0) AS review_count,
    p.brand
   FROM products p
     LEFT JOIN ( SELECT pv.product_id,
            sum(pv.stock) AS total_stock,
            array_agg(DISTINCT pv.size) AS available_sizes,
            array_agg(DISTINCT pv.color) AS available_colors,
            min(COALESCE(pv.price_override, pr.price)) AS min_price
           FROM product_variants pv
             JOIN products pr ON pr.id = pv.product_id
          GROUP BY pv.product_id) v ON v.product_id = p.id
     LEFT JOIN ( SELECT reviews.product_id,
            avg(reviews.rating) AS avg_rating,
            count(*)::integer AS review_count
           FROM reviews
          GROUP BY reviews.product_id) r ON r.product_id = p.id;
