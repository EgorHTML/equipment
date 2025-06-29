export interface FileMetadata {
    id: number;
    file_name: string; // Оригинальное имя файла
    file_type: string | null; // MIME-тип файла
    file_size: number | null; // Размер файла в байтах
    storage_url: string; // URL для доступа к файлу в MinIO/S3
    uploaded_by: number; // ID пользователя, загрузившего файл
    created_at: Date; // Дата и время создания записи в БД
  }