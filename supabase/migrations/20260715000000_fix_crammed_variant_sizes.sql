-- Data fixup: product_variants.size / products.sizes were entered as a single
-- slash-joined string (e.g. '41/42/43/44/45') instead of one row/entry per size,
-- and stock was the COUNT of sizes rather than a real per-size count. This made
-- the product page treat the whole string as one selectable "size", which is why
-- the cart showed e.g. "Size 40/42/43/44/45" for a single selection.
--
-- Fix: split each crammed variant into one row per size, stock = 1 each (the exact
-- per-size counts weren't recoverable from the crammed data; the owner tops up real
-- quantities per size in the admin). Duplicates/empty segments from the original
-- string are dropped. products.sizes/colors are rebuilt from the same cleaned data
-- so the legacy fallback path (products with no variants) matches too.

begin;

-- Remove the old crammed variant rows.
delete from public.product_variants where id in (
  '15eefc1e-afae-42c2-a61c-7a1baae5ec55',
  'e003501a-9d7d-406a-8ae3-1e63b34e7a1c',
  '7f72fbb4-faa7-4eb0-8e6a-95a2314420b5',
  'a5002a19-f41e-489d-9926-9a7ce4e97463',
  '73350fd7-6ed7-47f1-b01c-6c9fbe47a085',
  '39c5de67-d7cc-4686-a056-761e5f0f6e5b',
  '419a3140-7de3-4bfa-a531-c54b61084a8b',
  '4f63f79a-1dc2-4dee-9c86-2594490ebca8',
  '0b838d74-e81a-48e0-9bd2-5e73e5203c5c',
  '57cab5d9-ea73-496a-90af-a42702b68880',
  '6e1c33d9-cb4a-4548-986e-e066f2ea63a8',
  '3505ec77-a3cf-40b2-83d6-a0fdaffe40dc',
  '7405fc81-8e61-446d-8d0b-15a5bcc43d9c',
  '77f5af82-4229-4e8a-abe8-6bd2136241b6',
  '7aa3e589-08e4-41a2-a6b6-1bda76e67838',
  '7cc1c648-5f03-46d5-a35d-c207e25eeb8e',
  'a274f88f-3896-4785-a87a-1ee6a5e61653',
  '9b198281-f6b5-43bf-9fbf-4f85e18dd3dd',
  '42727055-f70b-4798-89c7-80bfde41d02f',
  '19b65cb4-df75-4122-8280-94367cae190b',
  '3d650dd8-2299-4f72-82da-101366ce3001',
  'bf563ebb-1c08-4800-ad02-53fe2ee10ab9',
  'e015ecfd-cf77-43da-b01a-83e650a07682',
  '0297f755-2271-4419-af8a-f7704bea60a7',
  'ea155c1b-5536-40aa-b439-241d0efb7f7e',
  'c7690ba4-2272-4e5b-9e69-1b932f068454',
  '8279ce57-37f3-4a6e-b0a1-b5b70014eac5',
  '370af906-1022-409c-8a9f-e746d339d457',
  '00e082d3-6311-4daa-8172-dba768adf932',
  '5d62a81c-1480-4667-9480-4bb33017ec88',
  '643fd219-45db-49d0-92c5-2e152478677b',
  '2e1d3f2d-21e9-49cf-a1b0-d0e0861e1b9e',
  '11a92ef6-5245-44b2-8533-9010d7139fbb',
  'd54e1c8d-dd16-4155-a9c6-78a459e5bdbb',
  '06987be8-55f9-47ba-9680-35a5f91fde13',
  '3f662020-7b44-489b-905a-3d770d484019',
  '1919b70a-f069-4ab6-8b6f-bd371a99f9c5',
  '9b1c22e9-8215-4a88-97ec-1f827df98ef4',
  '3ce36a61-3916-446d-85ff-147c30be8d16',
  'a9d1f819-70f4-4dea-b720-9b6b3ce1003d',
  '35fe60b7-a640-4e7d-8146-b5b7ce5e4f93',
  '6f2ba874-f32a-44f2-9253-95a176c2cc14',
  '1d2e33bf-81fa-494c-982f-551898ab17a1',
  '111d03d7-ce78-4e9e-92df-3d7f672645c1',
  'd76bc991-8f06-48e3-955a-ef40f9ff9e40',
  'cf1b3471-a8af-4e6b-bd8e-6f435fa4c059',
  '90e18b8c-bf1a-4c0f-973f-65fd18090ef8',
  'f853762f-e68f-4ccd-9395-48d93168c903',
  '77da047a-2ab5-4610-bd0d-6425e1707f83',
  '30b4e363-b7e8-4a11-83ab-5fa5befadf73',
  'b4b553e4-ccd9-46c7-8d57-53487d73bce8',
  'f293362f-0160-422f-ace8-a3a7afd6bcae',
  '59437755-e82c-4535-a536-bce769a28989',
  'ba4b85b2-8b82-4a2a-877e-633f7dd41dcf',
  '57d903d1-2675-4695-adb5-d5438c384642',
  '3ad67961-d72f-4663-a97e-ffc1f001c6f5',
  '6f98f4b4-32bf-453c-b7f1-6fff07d33ddc',
  '08fc5a45-620c-4591-af43-b5f62c297f3e',
  '8d3ddc60-93af-4d97-a012-667ff8ebbbff',
  'ac10095f-f5cb-4e04-8257-fb434c506839',
  'f76883ab-b415-4387-92db-734adcaf8a26',
  'a0df54d7-85c7-48d8-97a1-31463b20d968',
  '553fe02e-97ad-4f45-9094-9e88a46e4ff3',
  '3c28a628-d430-4bc2-a83c-70f746907d98',
  '33687aa8-55e3-48c1-a55e-da45ebc46acd',
  'e6f65ef3-9f15-4471-9ea0-e34e5a3287c5',
  '620d5542-5abf-4e19-831f-39aeed5ddd76',
  'ae5a6def-eb7e-4097-ad66-4a8fbaf8d4bd',
  'dafdecce-7d25-414e-aaf7-94255648ec31',
  '435e61df-0905-4f10-a4a3-62bd54ed94cc',
  'e58c4797-1c9e-4bb6-b087-fa2099cc4913',
  'e7a21257-384a-4c2f-a948-e8a6a4b7d8af',
  '073f2d9a-86ef-4ce0-bacf-6b2d69582b66',
  'ea76e65a-6cf8-4799-b92b-c7bcd2914578',
  'ff84f068-9531-41bd-b188-a5165caf0a03',
  '8b23e30a-3756-4350-af6f-70959c7d2d85',
  'f87b28c4-ff35-44a6-a8ca-a36a56737094',
  'c930ea10-371d-4e95-a62f-ace6b7dbd199',
  '95cc17c4-f468-40d8-8cb9-8d24af44a3ad',
  '3c1f505b-0f76-4f24-b1e8-d8cdce5059a4',
  '18c5c09e-f1d5-4075-b2a5-1d582a9bc0e6',
  'c42375a8-ac0d-499c-b7c0-fef8e7159f17',
  '0a976c2b-d61d-4557-883b-0d2292d39d28',
  '4da04f62-dcbe-4bd6-b49e-18395825e8a8',
  'b1b82c71-908f-4755-aaf4-4d0f0db8de29',
  '42a228f2-c6f9-4cae-99f0-0427932fca3f',
  'cc08d231-cd03-41cd-8892-fb11df46108e'
);

-- Insert one row per size (stock 1 each).
insert into public.product_variants (product_id, size, color, stock, price_override) values
  ('b471868f-51f3-4e3f-a95f-bfe2910e68a5', '43', 'ازرق', 1, NULL),
  ('8ce61f49-7a77-4106-a2cf-ab4f99b98039', '40', 'اسود', 1, NULL),
  ('8ce61f49-7a77-4106-a2cf-ab4f99b98039', '41', 'اسود', 1, NULL),
  ('8ce61f49-7a77-4106-a2cf-ab4f99b98039', '44', 'اسود', 1, NULL),
  ('a6b75495-c45c-4761-9fcd-c5f995e58c51', '42', 'مزيج اسود وأزرق', 1, NULL),
  ('a6b75495-c45c-4761-9fcd-c5f995e58c51', '45', 'مزيج اسود وأزرق', 1, NULL),
  ('a6b75495-c45c-4761-9fcd-c5f995e58c51', '43', 'مزيج اسود وأزرق', 1, NULL),
  ('fad4f659-df47-4589-9daf-b83c45629064', '42', 'اسود', 1, NULL),
  ('fad4f659-df47-4589-9daf-b83c45629064', '43', 'اسود', 1, NULL),
  ('6b29cdb5-0e8e-4ac4-98b5-7eede0158b2c', '41', 'ابيض ذهبي', 1, NULL),
  ('6b29cdb5-0e8e-4ac4-98b5-7eede0158b2c', '42', 'ابيض ذهبي', 1, NULL),
  ('6b29cdb5-0e8e-4ac4-98b5-7eede0158b2c', '43', 'ابيض ذهبي', 1, NULL),
  ('6b29cdb5-0e8e-4ac4-98b5-7eede0158b2c', '44', 'ابيض ذهبي', 1, NULL),
  ('29b01e36-4684-4e8a-8c12-c37c65866282', '41', 'ابيض', 1, NULL),
  ('95003e1f-acfa-4783-8ea0-86ad9c6c8be2', '40', 'ابيض', 1, NULL),
  ('95003e1f-acfa-4783-8ea0-86ad9c6c8be2', '41', 'ابيض', 1, NULL),
  ('95003e1f-acfa-4783-8ea0-86ad9c6c8be2', '43', 'ابيض', 1, NULL),
  ('95003e1f-acfa-4783-8ea0-86ad9c6c8be2', '44', 'ابيض', 1, NULL),
  ('591fd177-722a-4690-b935-b00bacd9a04c', '41', 'كحلي', 1, NULL),
  ('591fd177-722a-4690-b935-b00bacd9a04c', '42', 'كحلي', 1, NULL),
  ('591fd177-722a-4690-b935-b00bacd9a04c', '43', 'كحلي', 1, NULL),
  ('591fd177-722a-4690-b935-b00bacd9a04c', '44', 'كحلي', 1, NULL),
  ('761bd1f9-52be-47af-8535-b785887fe2aa', '41', 'اسود', 1, NULL),
  ('761bd1f9-52be-47af-8535-b785887fe2aa', '42', 'اسود', 1, NULL),
  ('761bd1f9-52be-47af-8535-b785887fe2aa', '43', 'اسود', 1, NULL),
  ('761bd1f9-52be-47af-8535-b785887fe2aa', '44', 'اسود', 1, NULL),
  ('1d308aec-f0e7-4aa3-b6f8-6c32fb687425', '40', 'ابيض في اسود', 1, NULL),
  ('1d308aec-f0e7-4aa3-b6f8-6c32fb687425', '41', 'ابيض في اسود', 1, NULL),
  ('1d308aec-f0e7-4aa3-b6f8-6c32fb687425', '42', 'ابيض في اسود', 1, NULL),
  ('1d308aec-f0e7-4aa3-b6f8-6c32fb687425', '43', 'ابيض في اسود', 1, NULL),
  ('1d308aec-f0e7-4aa3-b6f8-6c32fb687425', '44', 'ابيض في اسود', 1, NULL),
  ('1d308aec-f0e7-4aa3-b6f8-6c32fb687425', '45', 'ابيض في اسود', 1, NULL),
  ('e16174da-b30c-4c12-bc4b-6c9149cae464', '42', 'اسود وذهبي', 1, NULL),
  ('e16174da-b30c-4c12-bc4b-6c9149cae464', '43', 'اسود وذهبي', 1, NULL),
  ('e16174da-b30c-4c12-bc4b-6c9149cae464', '44', 'اسود وذهبي', 1, NULL),
  ('e16174da-b30c-4c12-bc4b-6c9149cae464', '45', 'اسود وذهبي', 1, NULL),
  ('c49c0453-2196-432e-b227-a70eec663b92', '41', 'اسود', 1, NULL),
  ('c49c0453-2196-432e-b227-a70eec663b92', '31', 'اسود', 1, NULL),
  ('c49c0453-2196-432e-b227-a70eec663b92', '42', 'اسود', 1, NULL),
  ('c49c0453-2196-432e-b227-a70eec663b92', '46', 'اسود', 1, NULL),
  ('30a15459-bba4-42c4-a58d-700fc9e0902f', '40', 'اسود قطعة ذهبي', 1, NULL),
  ('30a15459-bba4-42c4-a58d-700fc9e0902f', '41', 'اسود قطعة ذهبي', 1, NULL),
  ('30a15459-bba4-42c4-a58d-700fc9e0902f', '42', 'اسود قطعة ذهبي', 1, NULL),
  ('30a15459-bba4-42c4-a58d-700fc9e0902f', '43', 'اسود قطعة ذهبي', 1, NULL),
  ('30a15459-bba4-42c4-a58d-700fc9e0902f', '44', 'اسود قطعة ذهبي', 1, NULL),
  ('0deada98-38a5-4001-8c71-9ea27ba2b7ec', '44', 'ابيض', 1, NULL),
  ('0deada98-38a5-4001-8c71-9ea27ba2b7ec', '45', 'ابيض', 1, NULL),
  ('c8ca6011-ea07-4ec8-a7b2-dc0abffe1a19', '41', 'اسود', 1, NULL),
  ('c8ca6011-ea07-4ec8-a7b2-dc0abffe1a19', '42', 'اسود', 1, NULL),
  ('c8ca6011-ea07-4ec8-a7b2-dc0abffe1a19', '43', 'اسود', 1, NULL),
  ('c8ca6011-ea07-4ec8-a7b2-dc0abffe1a19', '44', 'اسود', 1, NULL),
  ('c8ca6011-ea07-4ec8-a7b2-dc0abffe1a19', '45', 'اسود', 1, NULL),
  ('eee387ae-9a28-40d7-a1cb-518d59eadfad', '42', 'مزيج ابيض واسود', 1, NULL),
  ('eee387ae-9a28-40d7-a1cb-518d59eadfad', '44', 'مزيج ابيض واسود', 1, NULL),
  ('eee387ae-9a28-40d7-a1cb-518d59eadfad', '40', 'مزيج ابيض واسود', 1, NULL),
  ('eee387ae-9a28-40d7-a1cb-518d59eadfad', '41', 'مزيج ابيض واسود', 1, NULL),
  ('eee387ae-9a28-40d7-a1cb-518d59eadfad', '43', 'مزيج ابيض واسود', 1, NULL),
  ('eee387ae-9a28-40d7-a1cb-518d59eadfad', '45', 'مزيج ابيض واسود', 1, NULL),
  ('e1bdce9f-bb53-4cfa-a090-60eb5982bc42', '41', 'اسود', 1, NULL),
  ('e1bdce9f-bb53-4cfa-a090-60eb5982bc42', '42', 'اسود', 1, NULL),
  ('e1bdce9f-bb53-4cfa-a090-60eb5982bc42', '45', 'اسود', 1, NULL),
  ('e1bdce9f-bb53-4cfa-a090-60eb5982bc42', '46', 'اسود', 1, NULL),
  ('3da5ae4e-d018-4fde-88d6-71f931b071cf', '43', 'ابيض', 1, NULL),
  ('3da5ae4e-d018-4fde-88d6-71f931b071cf', '44', 'ابيض', 1, NULL),
  ('3da5ae4e-d018-4fde-88d6-71f931b071cf', '45', 'ابيض', 1, NULL),
  ('13bd3e31-089b-47b7-82f1-5b8e487cea37', '40', 'اسود', 1, NULL),
  ('13bd3e31-089b-47b7-82f1-5b8e487cea37', '42', 'اسود', 1, NULL),
  ('13bd3e31-089b-47b7-82f1-5b8e487cea37', '43', 'اسود', 1, NULL),
  ('13bd3e31-089b-47b7-82f1-5b8e487cea37', '44', 'اسود', 1, NULL),
  ('13bd3e31-089b-47b7-82f1-5b8e487cea37', '45', 'اسود', 1, NULL),
  ('83e822c9-a969-424f-a671-18fc3d0dc1f4', '41', 'سلفر', 1, NULL),
  ('83e822c9-a969-424f-a671-18fc3d0dc1f4', '40', 'سلفر', 1, NULL),
  ('dac2ee9b-2fde-4b76-ac20-4be8dc60e0ed', '44', 'اسود', 1, NULL),
  ('dac2ee9b-2fde-4b76-ac20-4be8dc60e0ed', '45', 'اسود', 1, NULL),
  ('112637cd-5a1e-4c67-aaa2-5daa22474d8c', '45', 'اسود', 1, NULL),
  ('07e192d9-5c81-40ad-8b2d-944073e1ca4b', '41', 'بني', 1, NULL),
  ('07e192d9-5c81-40ad-8b2d-944073e1ca4b', '42', 'بني', 1, NULL),
  ('07e192d9-5c81-40ad-8b2d-944073e1ca4b', '43', 'بني', 1, NULL),
  ('e18dd52b-30f9-45da-a523-5814b54cf57f', '41', 'اسود', 1, NULL),
  ('e18dd52b-30f9-45da-a523-5814b54cf57f', '42', 'اسود', 1, NULL),
  ('e45041fe-0d38-4998-b7f3-4c451edbc4a0', '41', 'ابيض', 1, NULL),
  ('e45041fe-0d38-4998-b7f3-4c451edbc4a0', '42', 'ابيض', 1, NULL),
  ('e45041fe-0d38-4998-b7f3-4c451edbc4a0', '43', 'ابيض', 1, NULL),
  ('e45041fe-0d38-4998-b7f3-4c451edbc4a0', '44', 'ابيض', 1, NULL),
  ('e45041fe-0d38-4998-b7f3-4c451edbc4a0', '45', 'ابيض', 1, NULL),
  ('5af5089d-e39f-405d-9c6d-a44118ed2d9e', '41', 'اسود قطعة ذهبي', 1, NULL),
  ('5af5089d-e39f-405d-9c6d-a44118ed2d9e', '42', 'اسود قطعة ذهبي', 1, NULL),
  ('5af5089d-e39f-405d-9c6d-a44118ed2d9e', '43', 'اسود قطعة ذهبي', 1, NULL),
  ('5af5089d-e39f-405d-9c6d-a44118ed2d9e', '44', 'اسود قطعة ذهبي', 1, NULL),
  ('d7dd9d32-8476-488e-8aeb-23a8b4fb1e48', '41', 'اسود', 1, NULL),
  ('d7dd9d32-8476-488e-8aeb-23a8b4fb1e48', '42', 'اسود', 1, NULL),
  ('d7dd9d32-8476-488e-8aeb-23a8b4fb1e48', '44', 'اسود', 1, NULL),
  ('d7dd9d32-8476-488e-8aeb-23a8b4fb1e48', '45', 'اسود', 1, NULL),
  ('07564f94-8d0d-4b53-b604-f1c5b0ff5326', '41', 'اسود و ابيض', 1, NULL),
  ('07564f94-8d0d-4b53-b604-f1c5b0ff5326', '42', 'اسود و ابيض', 1, NULL),
  ('07564f94-8d0d-4b53-b604-f1c5b0ff5326', '44', 'اسود و ابيض', 1, NULL),
  ('07564f94-8d0d-4b53-b604-f1c5b0ff5326', '45', 'اسود و ابيض', 1, NULL),
  ('4acf5e43-a2ba-4ae4-b4dd-cde787393428', '41', 'جيشي', 1, NULL),
  ('4acf5e43-a2ba-4ae4-b4dd-cde787393428', '42', 'جيشي', 1, NULL),
  ('4acf5e43-a2ba-4ae4-b4dd-cde787393428', '43', 'جيشي', 1, NULL),
  ('4acf5e43-a2ba-4ae4-b4dd-cde787393428', '44', 'جيشي', 1, NULL),
  ('4acf5e43-a2ba-4ae4-b4dd-cde787393428', '45', 'جيشي', 1, NULL),
  ('6f9a77a9-0bd0-471c-aec0-deef52fadb8d', '41', 'اسود', 1, NULL),
  ('6f9a77a9-0bd0-471c-aec0-deef52fadb8d', '42', 'اسود', 1, NULL),
  ('c696c155-fa3a-49a3-b0a0-a6a489748a69', '43', 'زيتي', 1, NULL),
  ('c696c155-fa3a-49a3-b0a0-a6a489748a69', '45', 'زيتي', 1, NULL),
  ('9a80ba7e-d555-40ef-b07b-963ade09a363', '40', 'ابيض واسود', 1, NULL),
  ('9a80ba7e-d555-40ef-b07b-963ade09a363', '41', 'ابيض واسود', 1, NULL),
  ('47dcf8a0-4f6c-4bf7-93ce-325470a62d22', '40', 'ابيض واسود', 1, NULL),
  ('dcbcadac-4128-4e86-af1e-af11d736a6d5', '42', 'اسود', 1, NULL),
  ('dcbcadac-4128-4e86-af1e-af11d736a6d5', '43', 'اسود', 1, NULL),
  ('dcbcadac-4128-4e86-af1e-af11d736a6d5', '44', 'اسود', 1, NULL),
  ('dcbcadac-4128-4e86-af1e-af11d736a6d5', '45', 'اسود', 1, NULL),
  ('96245811-2ed2-4bb9-8a75-cb87d036f607', '44', 'ابيض واسود', 1, NULL),
  ('96245811-2ed2-4bb9-8a75-cb87d036f607', '45', 'ابيض واسود', 1, NULL),
  ('d4c172a3-9839-44f4-b31b-b90d87595520', '42', 'اسود', 1, NULL),
  ('796f89b0-68db-4c7b-b5d1-0e8609b2a5f6', '43', 'اسود قطعة دهبي', 1, NULL),
  ('796f89b0-68db-4c7b-b5d1-0e8609b2a5f6', '44', 'اسود قطعة دهبي', 1, NULL),
  ('80f0d435-e4b9-4afd-8650-36f663c05e31', '42', 'اسود', 1, NULL),
  ('80f0d435-e4b9-4afd-8650-36f663c05e31', '43', 'اسود', 1, NULL),
  ('b2734d99-e6e4-4276-9d3c-8fd239f2ce37', '42', 'ابيض', 1, NULL),
  ('b2734d99-e6e4-4276-9d3c-8fd239f2ce37', '44', 'ابيض', 1, NULL),
  ('b2734d99-e6e4-4276-9d3c-8fd239f2ce37', '45', 'ابيض', 1, NULL),
  ('1cf1773c-584e-4fd4-84c8-079a6d145d62', '41', 'اسود', 1, NULL),
  ('1cf1773c-584e-4fd4-84c8-079a6d145d62', '45', 'اسود', 1, NULL),
  ('5c93994e-f406-4026-8313-38aa5efbcb98', '41', 'ابيض', 1, NULL),
  ('5c93994e-f406-4026-8313-38aa5efbcb98', '42', 'ابيض', 1, NULL),
  ('5c93994e-f406-4026-8313-38aa5efbcb98', '43', 'ابيض', 1, NULL),
  ('5c93994e-f406-4026-8313-38aa5efbcb98', '44', 'ابيض', 1, NULL),
  ('cfec76da-fafd-4afe-9db1-b86b51158085', '43', 'بني', 1, NULL),
  ('12da47b3-9860-4be3-a600-9805b7585c51', '41', 'اسود', 1, NULL),
  ('12da47b3-9860-4be3-a600-9805b7585c51', '42', 'اسود', 1, NULL),
  ('12da47b3-9860-4be3-a600-9805b7585c51', '44', 'اسود', 1, NULL),
  ('12da47b3-9860-4be3-a600-9805b7585c51', '45', 'اسود', 1, NULL),
  ('23068fc4-6d25-4e50-a8c5-0d1ba5f8dd80', '45', 'اسود نعل ذهبي', 1, NULL),
  ('7453f63a-1b15-4f9d-a279-c66ddd216a72', '45', 'ابيض', 1, NULL),
  ('3399be29-90ad-4b52-b933-9dc81319425a', '42', 'ابيض واسود', 1, NULL),
  ('3399be29-90ad-4b52-b933-9dc81319425a', '44', 'ابيض واسود', 1, NULL),
  ('3399be29-90ad-4b52-b933-9dc81319425a', '45', 'ابيض واسود', 1, NULL),
  ('2f947998-330f-406f-ba22-c60e884f4eff', '44', 'مزيج الأسود والأزرق', 1, NULL),
  ('2f947998-330f-406f-ba22-c60e884f4eff', '45', 'مزيج الأسود والأزرق', 1, NULL),
  ('23d9f58f-62fa-4018-a3fa-50f8f9cf20ea', '43', 'الأبيض في ازرق', 1, NULL),
  ('23d9f58f-62fa-4018-a3fa-50f8f9cf20ea', '44', 'الأبيض في ازرق', 1, NULL),
  ('8263f02b-6eeb-41dc-a6a5-ef415094d1ea', '41', 'اسود', 1, NULL),
  ('8263f02b-6eeb-41dc-a6a5-ef415094d1ea', '42', 'اسود', 1, NULL),
  ('8263f02b-6eeb-41dc-a6a5-ef415094d1ea', '44', 'اسود', 1, NULL),
  ('8263f02b-6eeb-41dc-a6a5-ef415094d1ea', '45', 'اسود', 1, NULL),
  ('7b4bd69b-08b2-4fb0-89e2-358d1e8214fd', '41', 'ابيض في اسود', 1, NULL),
  ('7b4bd69b-08b2-4fb0-89e2-358d1e8214fd', '43', 'ابيض في اسود', 1, NULL),
  ('7b4bd69b-08b2-4fb0-89e2-358d1e8214fd', '44', 'ابيض في اسود', 1, NULL),
  ('8940d5bc-a36c-4ff6-b6a9-d86be9037c0a', '3”43', 'اخضر', 1, NULL),
  ('d457e65e-3695-4926-a784-cdbbdfe64ed5', '43', 'مزيج ابيض واسود', 1, NULL),
  ('5540fc29-a06a-4828-90ae-06f69fa00085', '41', 'اسود', 1, NULL),
  ('5540fc29-a06a-4828-90ae-06f69fa00085', '42', 'اسود', 1, NULL),
  ('5540fc29-a06a-4828-90ae-06f69fa00085', '44', 'اسود', 1, NULL),
  ('20421658-d5b5-4067-a32c-d366a3fd03f4', '32', 'اسود في اصفر', 1, NULL),
  ('20421658-d5b5-4067-a32c-d366a3fd03f4', '44', 'اسود في اصفر', 1, NULL),
  ('20421658-d5b5-4067-a32c-d366a3fd03f4', '45', 'اسود في اصفر', 1, NULL),
  ('a3ce6e86-d898-4bc9-83a4-4ab708ae9183', '43', 'ابيض', 1, NULL),
  ('e653e480-3ae1-4494-8fca-62ea962d1afb', '41', 'اسود', 1, NULL),
  ('e653e480-3ae1-4494-8fca-62ea962d1afb', '42', 'اسود', 1, NULL),
  ('e653e480-3ae1-4494-8fca-62ea962d1afb', '44', 'اسود', 1, NULL),
  ('e653e480-3ae1-4494-8fca-62ea962d1afb', '45', 'اسود', 1, NULL),
  ('8abfbeeb-bfa7-4d59-9062-0a2f97b09a20', '42', 'ابيض', 1, NULL),
  ('8abfbeeb-bfa7-4d59-9062-0a2f97b09a20', '44', 'ابيض', 1, NULL),
  ('df740166-c191-46fd-9e98-7f0d2dc292a3', '41', 'ابيض', 1, NULL),
  ('df740166-c191-46fd-9e98-7f0d2dc292a3', '42', 'ابيض', 1, NULL),
  ('df740166-c191-46fd-9e98-7f0d2dc292a3', '45', 'ابيض', 1, NULL),
  ('71dfe13e-2683-412c-b0eb-a03ddb2470d2', '41', 'ابيض', 1, NULL),
  ('71dfe13e-2683-412c-b0eb-a03ddb2470d2', '42', 'ابيض', 1, NULL),
  ('33769590-9f03-4ee3-aedc-5f724aadaec8', '43', 'اسود شريط ابيض', 1, NULL),
  ('33769590-9f03-4ee3-aedc-5f724aadaec8', '44', 'اسود شريط ابيض', 1, NULL),
  ('b922aa32-95f1-4ca8-bc93-947b35d657f9', '40', 'اسود', 1, NULL),
  ('b922aa32-95f1-4ca8-bc93-947b35d657f9', '41', 'اسود', 1, NULL),
  ('b922aa32-95f1-4ca8-bc93-947b35d657f9', '42', 'اسود', 1, NULL),
  ('b922aa32-95f1-4ca8-bc93-947b35d657f9', '43', 'اسود', 1, NULL),
  ('b922aa32-95f1-4ca8-bc93-947b35d657f9', '44', 'اسود', 1, NULL),
  ('680618b0-f222-47a6-a195-6098ff9ce530', '41', 'ابيض', 1, NULL),
  ('680618b0-f222-47a6-a195-6098ff9ce530', '42', 'ابيض', 1, NULL),
  ('680618b0-f222-47a6-a195-6098ff9ce530', '43', 'ابيض', 1, NULL),
  ('9a0b0196-04bb-400c-a5f7-a552fb5a1982', '41', 'بيج', 1, NULL),
  ('9a0b0196-04bb-400c-a5f7-a552fb5a1982', '42', 'بيج', 1, NULL),
  ('9a0b0196-04bb-400c-a5f7-a552fb5a1982', '43', 'بيج', 1, NULL),
  ('27edd63d-8121-4916-86a7-1734b42e7a80', '42', 'اسود خط رمادي', 1, NULL),
  ('27edd63d-8121-4916-86a7-1734b42e7a80', '43', 'اسود خط رمادي', 1, NULL),
  ('27edd63d-8121-4916-86a7-1734b42e7a80', '44', 'اسود خط رمادي', 1, NULL),
  ('2c5afd14-827d-4622-9cab-c784bd405d3f', '42', 'ابيض', 1, NULL),
  ('df8d4395-235f-4711-a598-11265b962c76', '44', 'بني', 1, NULL),
  ('78c667b5-8522-4c9f-bb00-b4a4c569b12b', '41', 'كحلي', 1, NULL),
  ('78c667b5-8522-4c9f-bb00-b4a4c569b12b', '42', 'كحلي', 1, NULL),
  ('78c667b5-8522-4c9f-bb00-b4a4c569b12b', '43', 'كحلي', 1, NULL),
  ('78c667b5-8522-4c9f-bb00-b4a4c569b12b', '44', 'كحلي', 1, NULL),
  ('bef04b02-979e-4640-8fbe-c78a79599ae5', '41', 'اسود', 1, NULL),
  ('bef04b02-979e-4640-8fbe-c78a79599ae5', '42', 'اسود', 1, NULL),
  ('3443d495-80ee-4321-acec-306220599eaf', '41', 'رمادي', 1, NULL),
  ('3443d495-80ee-4321-acec-306220599eaf', '42', 'رمادي', 1, NULL),
  ('3443d495-80ee-4321-acec-306220599eaf', '45', 'رمادي', 1, NULL),
  ('25ffaa7b-d4bf-4861-b2e8-c627ad4ff813', '42', 'ازرق', 1, NULL),
  ('25ffaa7b-d4bf-4861-b2e8-c627ad4ff813', '45', 'ازرق', 1, NULL),
  ('3e747ff8-e437-4ada-984f-cbe6e3388913', '45', 'ازرق', 1, NULL),
  ('28565596-507b-4f34-a8c9-2eae1cc06672', '43', 'اسود', 1, NULL),
  ('28565596-507b-4f34-a8c9-2eae1cc06672', '44', 'اسود', 1, NULL),
  ('28565596-507b-4f34-a8c9-2eae1cc06672', '45', 'اسود', 1, NULL),
  ('5a44f8cf-d14a-4a66-9388-29f25250bffe', '42', 'اسود', 1, NULL),
  ('5a44f8cf-d14a-4a66-9388-29f25250bffe', '43', 'اسود', 1, NULL),
  ('5a44f8cf-d14a-4a66-9388-29f25250bffe', '44', 'اسود', 1, NULL),
  ('5a44f8cf-d14a-4a66-9388-29f25250bffe', '45', 'اسود', 1, NULL),
  ('2d547384-3e34-42f9-9eba-793962600fcf', '41', 'اسود', 1, NULL),
  ('1f324c02-78df-4439-95a6-f38c4eded83c', '41', 'اسود', 1, NULL),
  ('1f324c02-78df-4439-95a6-f38c4eded83c', '42', 'اسود', 1, NULL),
  ('5400d79a-6ba4-4039-9105-431ee422fa69', '41', 'ابيض واسود', 1, NULL),
  ('5400d79a-6ba4-4039-9105-431ee422fa69', '43', 'ابيض واسود', 1, NULL),
  ('5400d79a-6ba4-4039-9105-431ee422fa69', '44', 'ابيض واسود', 1, NULL),
  ('5400d79a-6ba4-4039-9105-431ee422fa69', '45', 'ابيض واسود', 1, NULL),
  ('e5bd006e-8d1e-43b9-9351-0e942a8776cd', '41', 'كحلي', 1, NULL),
  ('e5bd006e-8d1e-43b9-9351-0e942a8776cd', '42', 'كحلي', 1, NULL),
  ('e5bd006e-8d1e-43b9-9351-0e942a8776cd', '43', 'كحلي', 1, NULL),
  ('12afe507-4878-411c-a6d6-f8a8980d189c', '41', 'بني', 1, NULL),
  ('12afe507-4878-411c-a6d6-f8a8980d189c', '42', 'بني', 1, NULL),
  ('868d4e85-dfd6-4ca9-b378-31fdef70628c', '42', 'ابيض', 1, NULL),
  ('868d4e85-dfd6-4ca9-b378-31fdef70628c', '43', 'ابيض', 1, NULL),
  ('2648e3fa-3805-4e49-ac39-74992823ea11', '41', 'اسود', 1, NULL),
  ('2648e3fa-3805-4e49-ac39-74992823ea11', '42', 'اسود', 1, NULL),
  ('2648e3fa-3805-4e49-ac39-74992823ea11', '43', 'اسود', 1, NULL),
  ('5368644d-1feb-44bb-bb59-b0387a6b3e5e', '42', 'اسود', 1, NULL),
  ('5368644d-1feb-44bb-bb59-b0387a6b3e5e', '43', 'اسود', 1, NULL),
  ('d946d864-6c39-4475-9027-023d89a8d6da', '41', 'بني', 1, NULL),
  ('d946d864-6c39-4475-9027-023d89a8d6da', '42', 'بني', 1, NULL),
  ('d946d864-6c39-4475-9027-023d89a8d6da', '43', 'بني', 1, NULL),
  ('d946d864-6c39-4475-9027-023d89a8d6da', '45', 'بني', 1, NULL),
  ('00d91abd-f19a-43ff-bafa-9f78aea45697', '44', 'اسود', 1, NULL),
  ('24021f47-b437-47a8-a182-f38a8d7624ba', '42', 'ابيض', 1, NULL),
  ('bb3f8553-8adb-4f62-96d9-7049d371fb10', '42', 'اسود', 1, NULL),
  ('bb3f8553-8adb-4f62-96d9-7049d371fb10', '44', 'اسود', 1, NULL),
  ('bb3f8553-8adb-4f62-96d9-7049d371fb10', '45', 'اسود', 1, NULL),
  ('a5bd42b9-2574-4a60-8c4c-a9be1f81ed65', '41', 'كحلي', 1, NULL),
  ('a5bd42b9-2574-4a60-8c4c-a9be1f81ed65', '42', 'كحلي', 1, NULL),
  ('a5bd42b9-2574-4a60-8c4c-a9be1f81ed65', '43', 'كحلي', 1, NULL),
  ('a5bd42b9-2574-4a60-8c4c-a9be1f81ed65', '44', 'كحلي', 1, NULL),
  ('a5bd42b9-2574-4a60-8c4c-a9be1f81ed65', '45', 'كحلي', 1, NULL),
  ('2d07f318-cde9-4822-9403-9b124627b6e3', '42', 'ابيض', 1, NULL);

-- Rebuild the legacy products.sizes / products.colors arrays to match (used as a
-- fallback display/selection when a product has no variants -- keep them consistent).
update public.products set sizes = ARRAY['43']::text[], colors = ARRAY['ازرق']::text[] where id = 'b471868f-51f3-4e3f-a95f-bfe2910e68a5';
update public.products set sizes = ARRAY['40','41','44']::text[], colors = ARRAY['اسود']::text[] where id = '8ce61f49-7a77-4106-a2cf-ab4f99b98039';
update public.products set sizes = ARRAY['42','45','43']::text[], colors = ARRAY['مزيج اسود وأزرق']::text[] where id = 'a6b75495-c45c-4761-9fcd-c5f995e58c51';
update public.products set sizes = ARRAY['42','43']::text[], colors = ARRAY['اسود']::text[] where id = 'fad4f659-df47-4589-9daf-b83c45629064';
update public.products set sizes = ARRAY['41','42','43','44']::text[], colors = ARRAY['ابيض ذهبي']::text[] where id = '6b29cdb5-0e8e-4ac4-98b5-7eede0158b2c';
update public.products set sizes = ARRAY['41']::text[], colors = ARRAY['ابيض']::text[] where id = '29b01e36-4684-4e8a-8c12-c37c65866282';
update public.products set sizes = ARRAY['40','41','43','44']::text[], colors = ARRAY['ابيض']::text[] where id = '95003e1f-acfa-4783-8ea0-86ad9c6c8be2';
update public.products set sizes = ARRAY['41','42','43','44']::text[], colors = ARRAY['كحلي']::text[] where id = '591fd177-722a-4690-b935-b00bacd9a04c';
update public.products set sizes = ARRAY['41','42','43','44']::text[], colors = ARRAY['اسود']::text[] where id = '761bd1f9-52be-47af-8535-b785887fe2aa';
update public.products set sizes = ARRAY['40','41','42','43','44','45']::text[], colors = ARRAY['ابيض في اسود']::text[] where id = '1d308aec-f0e7-4aa3-b6f8-6c32fb687425';
update public.products set sizes = ARRAY['42','43','44','45']::text[], colors = ARRAY['اسود وذهبي']::text[] where id = 'e16174da-b30c-4c12-bc4b-6c9149cae464';
update public.products set sizes = ARRAY['41','31','42','46']::text[], colors = ARRAY['اسود']::text[] where id = 'c49c0453-2196-432e-b227-a70eec663b92';
update public.products set sizes = ARRAY['40','41','42','43','44']::text[], colors = ARRAY['اسود قطعة ذهبي']::text[] where id = '30a15459-bba4-42c4-a58d-700fc9e0902f';
update public.products set sizes = ARRAY['44','45']::text[], colors = ARRAY['ابيض']::text[] where id = '0deada98-38a5-4001-8c71-9ea27ba2b7ec';
update public.products set sizes = ARRAY['41','42','43','44','45']::text[], colors = ARRAY['اسود']::text[] where id = 'c8ca6011-ea07-4ec8-a7b2-dc0abffe1a19';
update public.products set sizes = ARRAY['42','44','40','41','43','45']::text[], colors = ARRAY['مزيج ابيض واسود']::text[] where id = 'eee387ae-9a28-40d7-a1cb-518d59eadfad';
update public.products set sizes = ARRAY['41','42','45','46']::text[], colors = ARRAY['اسود']::text[] where id = 'e1bdce9f-bb53-4cfa-a090-60eb5982bc42';
update public.products set sizes = ARRAY['43','44','45']::text[], colors = ARRAY['ابيض']::text[] where id = '3da5ae4e-d018-4fde-88d6-71f931b071cf';
update public.products set sizes = ARRAY['40','42','43','44','45']::text[], colors = ARRAY['اسود']::text[] where id = '13bd3e31-089b-47b7-82f1-5b8e487cea37';
update public.products set sizes = ARRAY['41','40']::text[], colors = ARRAY['سلفر']::text[] where id = '83e822c9-a969-424f-a671-18fc3d0dc1f4';
update public.products set sizes = ARRAY['44','45']::text[], colors = ARRAY['اسود']::text[] where id = 'dac2ee9b-2fde-4b76-ac20-4be8dc60e0ed';
update public.products set sizes = ARRAY['45']::text[], colors = ARRAY['اسود']::text[] where id = '112637cd-5a1e-4c67-aaa2-5daa22474d8c';
update public.products set sizes = ARRAY['41','42','43']::text[], colors = ARRAY['بني']::text[] where id = '07e192d9-5c81-40ad-8b2d-944073e1ca4b';
update public.products set sizes = ARRAY['41','42']::text[], colors = ARRAY['اسود']::text[] where id = 'e18dd52b-30f9-45da-a523-5814b54cf57f';
update public.products set sizes = ARRAY['41','42','43','44','45']::text[], colors = ARRAY['ابيض']::text[] where id = 'e45041fe-0d38-4998-b7f3-4c451edbc4a0';
update public.products set sizes = ARRAY['41','42','43','44']::text[], colors = ARRAY['اسود قطعة ذهبي']::text[] where id = '5af5089d-e39f-405d-9c6d-a44118ed2d9e';
update public.products set sizes = ARRAY['41','42','44','45']::text[], colors = ARRAY['اسود']::text[] where id = 'd7dd9d32-8476-488e-8aeb-23a8b4fb1e48';
update public.products set sizes = ARRAY['41','42','44','45']::text[], colors = ARRAY['اسود و ابيض']::text[] where id = '07564f94-8d0d-4b53-b604-f1c5b0ff5326';
update public.products set sizes = ARRAY['41','42','43','44','45']::text[], colors = ARRAY['جيشي']::text[] where id = '4acf5e43-a2ba-4ae4-b4dd-cde787393428';
update public.products set sizes = ARRAY['41','42']::text[], colors = ARRAY['اسود']::text[] where id = '6f9a77a9-0bd0-471c-aec0-deef52fadb8d';
update public.products set sizes = ARRAY['43','45']::text[], colors = ARRAY['زيتي']::text[] where id = 'c696c155-fa3a-49a3-b0a0-a6a489748a69';
update public.products set sizes = ARRAY['40','41']::text[], colors = ARRAY['ابيض واسود']::text[] where id = '9a80ba7e-d555-40ef-b07b-963ade09a363';
update public.products set sizes = ARRAY['40']::text[], colors = ARRAY['ابيض واسود']::text[] where id = '47dcf8a0-4f6c-4bf7-93ce-325470a62d22';
update public.products set sizes = ARRAY['42','43','44','45']::text[], colors = ARRAY['اسود']::text[] where id = 'dcbcadac-4128-4e86-af1e-af11d736a6d5';
update public.products set sizes = ARRAY['44','45']::text[], colors = ARRAY['ابيض واسود']::text[] where id = '96245811-2ed2-4bb9-8a75-cb87d036f607';
update public.products set sizes = ARRAY['42']::text[], colors = ARRAY['اسود']::text[] where id = 'd4c172a3-9839-44f4-b31b-b90d87595520';
update public.products set sizes = ARRAY['43','44']::text[], colors = ARRAY['اسود قطعة دهبي']::text[] where id = '796f89b0-68db-4c7b-b5d1-0e8609b2a5f6';
update public.products set sizes = ARRAY['42','43']::text[], colors = ARRAY['اسود']::text[] where id = '80f0d435-e4b9-4afd-8650-36f663c05e31';
update public.products set sizes = ARRAY['42','44','45']::text[], colors = ARRAY['ابيض']::text[] where id = 'b2734d99-e6e4-4276-9d3c-8fd239f2ce37';
update public.products set sizes = ARRAY['41','45']::text[], colors = ARRAY['اسود']::text[] where id = '1cf1773c-584e-4fd4-84c8-079a6d145d62';
update public.products set sizes = ARRAY['41','42','43','44']::text[], colors = ARRAY['ابيض']::text[] where id = '5c93994e-f406-4026-8313-38aa5efbcb98';
update public.products set sizes = ARRAY['43']::text[], colors = ARRAY['بني']::text[] where id = 'cfec76da-fafd-4afe-9db1-b86b51158085';
update public.products set sizes = ARRAY['41','42','44','45']::text[], colors = ARRAY['اسود']::text[] where id = '12da47b3-9860-4be3-a600-9805b7585c51';
update public.products set sizes = ARRAY['45']::text[], colors = ARRAY['اسود نعل ذهبي']::text[] where id = '23068fc4-6d25-4e50-a8c5-0d1ba5f8dd80';
update public.products set sizes = ARRAY['45']::text[], colors = ARRAY['ابيض']::text[] where id = '7453f63a-1b15-4f9d-a279-c66ddd216a72';
update public.products set sizes = ARRAY['42','44','45']::text[], colors = ARRAY['ابيض واسود']::text[] where id = '3399be29-90ad-4b52-b933-9dc81319425a';
update public.products set sizes = ARRAY['44','45']::text[], colors = ARRAY['مزيج الأسود والأزرق']::text[] where id = '2f947998-330f-406f-ba22-c60e884f4eff';
update public.products set sizes = ARRAY['43','44']::text[], colors = ARRAY['الأبيض في ازرق']::text[] where id = '23d9f58f-62fa-4018-a3fa-50f8f9cf20ea';
update public.products set sizes = ARRAY['41','42','44','45']::text[], colors = ARRAY['اسود']::text[] where id = '8263f02b-6eeb-41dc-a6a5-ef415094d1ea';
update public.products set sizes = ARRAY['41','43','44']::text[], colors = ARRAY['ابيض في اسود']::text[] where id = '7b4bd69b-08b2-4fb0-89e2-358d1e8214fd';
update public.products set sizes = ARRAY['3”43']::text[], colors = ARRAY['اخضر']::text[] where id = '8940d5bc-a36c-4ff6-b6a9-d86be9037c0a';
update public.products set sizes = ARRAY['43']::text[], colors = ARRAY['مزيج ابيض واسود']::text[] where id = 'd457e65e-3695-4926-a784-cdbbdfe64ed5';
update public.products set sizes = ARRAY['41','42','44']::text[], colors = ARRAY['اسود']::text[] where id = '5540fc29-a06a-4828-90ae-06f69fa00085';
update public.products set sizes = ARRAY['32','44','45']::text[], colors = ARRAY['اسود في اصفر']::text[] where id = '20421658-d5b5-4067-a32c-d366a3fd03f4';
update public.products set sizes = ARRAY['43']::text[], colors = ARRAY['ابيض']::text[] where id = 'a3ce6e86-d898-4bc9-83a4-4ab708ae9183';
update public.products set sizes = ARRAY['41','42','44','45']::text[], colors = ARRAY['اسود']::text[] where id = 'e653e480-3ae1-4494-8fca-62ea962d1afb';
update public.products set sizes = ARRAY['42','44']::text[], colors = ARRAY['ابيض']::text[] where id = '8abfbeeb-bfa7-4d59-9062-0a2f97b09a20';
update public.products set sizes = ARRAY['41','42','45']::text[], colors = ARRAY['ابيض']::text[] where id = 'df740166-c191-46fd-9e98-7f0d2dc292a3';
update public.products set sizes = ARRAY['41','42']::text[], colors = ARRAY['ابيض']::text[] where id = '71dfe13e-2683-412c-b0eb-a03ddb2470d2';
update public.products set sizes = ARRAY['43','44']::text[], colors = ARRAY['اسود شريط ابيض']::text[] where id = '33769590-9f03-4ee3-aedc-5f724aadaec8';
update public.products set sizes = ARRAY['40','41','42','43','44']::text[], colors = ARRAY['اسود']::text[] where id = 'b922aa32-95f1-4ca8-bc93-947b35d657f9';
update public.products set sizes = ARRAY['41','42','43']::text[], colors = ARRAY['ابيض']::text[] where id = '680618b0-f222-47a6-a195-6098ff9ce530';
update public.products set sizes = ARRAY['41','42','43']::text[], colors = ARRAY['بيج']::text[] where id = '9a0b0196-04bb-400c-a5f7-a552fb5a1982';
update public.products set sizes = ARRAY['42','43','44']::text[], colors = ARRAY['اسود خط رمادي']::text[] where id = '27edd63d-8121-4916-86a7-1734b42e7a80';
update public.products set sizes = ARRAY['42']::text[], colors = ARRAY['ابيض']::text[] where id = '2c5afd14-827d-4622-9cab-c784bd405d3f';
update public.products set sizes = ARRAY['44']::text[], colors = ARRAY['بني']::text[] where id = 'df8d4395-235f-4711-a598-11265b962c76';
update public.products set sizes = ARRAY['41','42','43','44']::text[], colors = ARRAY['كحلي']::text[] where id = '78c667b5-8522-4c9f-bb00-b4a4c569b12b';
update public.products set sizes = ARRAY['41','42']::text[], colors = ARRAY['اسود']::text[] where id = 'bef04b02-979e-4640-8fbe-c78a79599ae5';
update public.products set sizes = ARRAY['41','42','45']::text[], colors = ARRAY['رمادي']::text[] where id = '3443d495-80ee-4321-acec-306220599eaf';
update public.products set sizes = ARRAY['42','45']::text[], colors = ARRAY['ازرق']::text[] where id = '25ffaa7b-d4bf-4861-b2e8-c627ad4ff813';
update public.products set sizes = ARRAY['45']::text[], colors = ARRAY['ازرق']::text[] where id = '3e747ff8-e437-4ada-984f-cbe6e3388913';
update public.products set sizes = ARRAY['43','44','45']::text[], colors = ARRAY['اسود']::text[] where id = '28565596-507b-4f34-a8c9-2eae1cc06672';
update public.products set sizes = ARRAY['42','43','44','45']::text[], colors = ARRAY['اسود']::text[] where id = '5a44f8cf-d14a-4a66-9388-29f25250bffe';
update public.products set sizes = ARRAY['41']::text[], colors = ARRAY['اسود']::text[] where id = '2d547384-3e34-42f9-9eba-793962600fcf';
update public.products set sizes = ARRAY['41','42']::text[], colors = ARRAY['اسود']::text[] where id = '1f324c02-78df-4439-95a6-f38c4eded83c';
update public.products set sizes = ARRAY['41','43','44','45']::text[], colors = ARRAY['ابيض واسود']::text[] where id = '5400d79a-6ba4-4039-9105-431ee422fa69';
update public.products set sizes = ARRAY['41','42','43']::text[], colors = ARRAY['كحلي']::text[] where id = 'e5bd006e-8d1e-43b9-9351-0e942a8776cd';
update public.products set sizes = ARRAY['41','42']::text[], colors = ARRAY['بني']::text[] where id = '12afe507-4878-411c-a6d6-f8a8980d189c';
update public.products set sizes = ARRAY['42','43']::text[], colors = ARRAY['ابيض']::text[] where id = '868d4e85-dfd6-4ca9-b378-31fdef70628c';
update public.products set sizes = ARRAY['41','42','43']::text[], colors = ARRAY['اسود']::text[] where id = '2648e3fa-3805-4e49-ac39-74992823ea11';
update public.products set sizes = ARRAY['42','43']::text[], colors = ARRAY['اسود']::text[] where id = '5368644d-1feb-44bb-bb59-b0387a6b3e5e';
update public.products set sizes = ARRAY['41','42','43','45']::text[], colors = ARRAY['بني']::text[] where id = 'd946d864-6c39-4475-9027-023d89a8d6da';
update public.products set sizes = ARRAY['44']::text[], colors = ARRAY['اسود']::text[] where id = '00d91abd-f19a-43ff-bafa-9f78aea45697';
update public.products set sizes = ARRAY['42']::text[], colors = ARRAY['ابيض']::text[] where id = '24021f47-b437-47a8-a182-f38a8d7624ba';
update public.products set sizes = ARRAY['42','44','45']::text[], colors = ARRAY['اسود']::text[] where id = 'bb3f8553-8adb-4f62-96d9-7049d371fb10';
update public.products set sizes = ARRAY['41','42','43','44','45']::text[], colors = ARRAY['كحلي']::text[] where id = 'a5bd42b9-2574-4a60-8c4c-a9be1f81ed65';
update public.products set sizes = ARRAY['42']::text[], colors = ARRAY['ابيض']::text[] where id = '2d07f318-cde9-4822-9403-9b124627b6e3';

commit;