CREATE POLICY "xgram_media_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'xgram-media');
CREATE POLICY "xgram_media_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'xgram-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "xgram_media_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'xgram-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'xgram-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "xgram_media_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'xgram-media' AND (storage.foldername(name))[1] = auth.uid()::text);