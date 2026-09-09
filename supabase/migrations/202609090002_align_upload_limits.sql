-- Rendered matricula pages can be up to 20 MB in the API. Keep the private
-- bucket limit aligned so valid pages are not rejected by Storage.
update storage.buckets
set public = false,
    file_size_limit = 20971520
where id = 'process-documents';
