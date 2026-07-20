update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
  'image/png',
  'image/jpeg',
  'image/tiff'
]
where id = 'process-documents';
