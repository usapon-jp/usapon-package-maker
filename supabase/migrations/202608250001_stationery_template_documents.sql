create or replace function public.is_box_document_v1(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
return
  jsonb_typeof(value) = 'object'
  and value -> 'schemaVersion' = '1'::jsonb
  and jsonb_typeof(value -> 'box') = 'object'
  and value #>> '{box,type}' in (
    'straight-tuck-carton-v1',
    'gift-box-v1',
    'n-style-gift-box-v1',
    'two-piece-gift-box-v1',
    'letter-paper-v1',
    'envelope-v1',
    'mini-card-v1'
  )
  and jsonb_typeof(value #> '{box,widthMm}') = 'number'
  and jsonb_typeof(value #> '{box,depthMm}') = 'number'
  and jsonb_typeof(value #> '{box,heightMm}') = 'number'
  and jsonb_typeof(value #> '{box,paperThicknessMm}') = 'number'
  and jsonb_typeof(value #> '{box,glueFlapMm}') = 'number'
  and jsonb_typeof(value -> 'design') = 'object'
  and jsonb_typeof(value #> '{design,backgroundColors}') = 'object'
  and jsonb_typeof(value #> '{design,artworkLayers}') = 'array'
  and jsonb_typeof(value #> '{design,stamps}') = 'array'
  and jsonb_typeof(value #> '{design,texts}') = 'array'
  and jsonb_typeof(value #> '{design,lineColors}') = 'object'
  and jsonb_typeof(value #> '{design,includeCalibrationPage}') = 'boolean';

revoke all on function public.is_box_document_v1(jsonb) from public;
