DROP TABLE IF EXISTS files_schema.equipment_files CASCADE; -- В схеме files
DROP TABLE IF EXISTS files_schema.files CASCADE; -- В схеме files

DROP SCHEMA IF EXISTS files_schema CASCADE;


-- === Создание Схем ===
CREATE SCHEMA IF NOT EXISTS files_schema;
COMMENT ON SCHEMA files_schema IS 'Schema for Files and their links';




-- === Таблицы для Сервиса Файлов (files_schema) ===

CREATE TABLE files_schema.files (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100), -- Увеличена длина для MIME-типов
    file_size BIGINT,
    storage_url VARCHAR(1024) NOT NULL UNIQUE, -- URL должен быть уникальным
    uploaded_by INT NOT NULL, -- ID пользователя из внешней системы
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE files_schema.files IS 'Metadata for uploaded files';

CREATE TABLE files_schema.equipment_files (
    -- В этой таблице храним ID оборудования из другой схемы
    -- Внешний ключ между схемами создавать НЕ РЕКОМЕНДУЕТСЯ для независимости сервисов.
    -- Целостность будет поддерживаться на уровне логики приложения (при удалении оборудования - вызов API сервиса файлов).
    equipment_id INT NOT NULL,
    file_id INT NOT NULL REFERENCES files_schema.files(id) ON DELETE CASCADE, -- Удаляем связь при удалении файла
    PRIMARY KEY (equipment_id, file_id)
);
COMMENT ON TABLE files_schema.equipment_files IS 'Link table between equipment (ID only) and files';



-- Индексы для files_schema
CREATE INDEX IF NOT EXISTS idx_equipment_files_file_id ON files_schema.equipment_files(file_id);
CREATE INDEX IF NOT EXISTS idx_equipment_files_equipment_id ON files_schema.equipment_files(equipment_id); -- Важен для поиска файлов по ID оборудования



