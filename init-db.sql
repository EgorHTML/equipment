-- -- Удаление старых объектов (для чистого перезапуска, если нужно)
-- -- Важно: Удаляем объекты в правильном порядке зависимостей или используем CASCADE
-- DROP TABLE IF EXISTS equipment_schema.equipment_ticket CASCADE;
-- DROP TABLE IF EXISTS equipment_schema.equipment_users CASCADE;
-- DROP TABLE IF EXISTS equipment_schema.equipment_company CASCADE;
-- DROP TABLE IF EXISTS equipment_schema.finite_equipment CASCADE;
-- DROP TABLE IF EXISTS files_schema.equipment_files CASCADE; -- В схеме files
-- DROP TABLE IF EXISTS equipment_schema.equipment CASCADE;
-- DROP TABLE IF EXISTS equipment_schema.categories CASCADE;
-- DROP TABLE IF EXISTS files_schema.files CASCADE; -- В схеме files

-- -- Удаляем материализованное представление, если оно было (лучше это делать через миграции)
-- -- DROP MATERIALIZED VIEW IF EXISTS equipment_schema.equipment_report; -- Если оно было в схеме
-- -- Удаляем старые схемы, если нужно начать совсем с нуля
-- DROP SCHEMA IF EXISTS equipment_schema CASCADE;
-- DROP SCHEMA IF EXISTS files_schema CASCADE;


-- -- === Создание Схем ===
-- CREATE SCHEMA IF NOT EXISTS equipment_schema;
-- CREATE SCHEMA IF NOT EXISTS files_schema;
-- COMMENT ON SCHEMA equipment_schema IS 'Schema for Equipment and related entities';
-- COMMENT ON SCHEMA files_schema IS 'Schema for Files and their links';

-- -- === Таблицы для Сервиса Оборудования (equipment_schema) ===

-- CREATE TABLE equipment_schema.categories (
--     id SERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     company_id INT NOT NULL -- ID из внешней системы
--     -- Можно добавить UNIQUE constraint на (name, company_id), если нужно
--     -- CONSTRAINT uq_category_name_company UNIQUE (name, company_id)
-- );
-- COMMENT ON TABLE equipment_schema.categories IS 'Equipment Categories';

-- CREATE TABLE equipment_schema.equipment (
--     id SERIAL PRIMARY KEY,
--     parent_id INT REFERENCES equipment_schema.equipment(id) ON DELETE SET NULL, -- Ссылка внутри схемы, ON DELETE SET NULL или RESTRICT
--     category_id INT NOT NULL,
--     name VARCHAR(255) NOT NULL,
--     serial_number VARCHAR(100) UNIQUE NOT NULL,
--     warranty_end DATE,
--     article VARCHAR(50),
--     description TEXT,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Используем TIMESTAMPTZ
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Используем TIMESTAMPTZ

--     CONSTRAINT fk_category FOREIGN KEY(category_id) REFERENCES equipment_schema.categories(id) ON DELETE RESTRICT -- Запрещаем удалять категорию, если есть оборудование
-- );
-- COMMENT ON TABLE equipment_schema.equipment IS 'Main equipment table with hierarchy';

-- CREATE TABLE equipment_schema.equipment_ticket (
--     ticket_id INT NOT NULL, -- ID из внешней системы
--     equipment_id INT NOT NULL REFERENCES equipment_schema.equipment(id) ON DELETE RESTRICT, -- Запрещаем удалять оборудование, если оно в заявке
--     quantity_used INT NOT NULL CHECK (quantity_used > 0),
--     recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     PRIMARY KEY (ticket_id, equipment_id)
-- );
-- COMMENT ON TABLE equipment_schema.equipment_ticket IS 'Link between external tickets and equipment usage';

-- CREATE TABLE equipment_schema.equipment_users (
--     user_id INT NOT NULL, -- ID из внешней системы
--     equipment_id INT NOT NULL REFERENCES equipment_schema.equipment(id) ON DELETE CASCADE, -- Удаляем связь при удалении оборудования
--     PRIMARY KEY (user_id, equipment_id)
-- );
-- COMMENT ON TABLE equipment_schema.equipment_users IS 'Link between external users and equipment';

-- CREATE TABLE equipment_schema.equipment_company (
--     company_id INT NOT NULL, -- ID из внешней системы
--     equipment_id INT NOT NULL REFERENCES equipment_schema.equipment(id) ON DELETE CASCADE, -- Удаляем связь при удалении оборудования
--     PRIMARY KEY (company_id, equipment_id)
-- );
-- COMMENT ON TABLE equipment_schema.equipment_company IS 'Link between external companies and equipment';

-- CREATE TABLE equipment_schema.finite_equipment (
--     equipment_id INT PRIMARY KEY REFERENCES equipment_schema.equipment(id) ON DELETE CASCADE, -- Удаляем запись о кол-ве при удалении оборудования
--     quantity INT NOT NULL CHECK (quantity >= 0)
-- );
-- COMMENT ON TABLE equipment_schema.finite_equipment IS 'Stores quantity for countable equipment items';


-- -- === Таблицы для Сервиса Файлов (files_schema) ===

-- CREATE TABLE files_schema.files (
--     id SERIAL PRIMARY KEY,
--     file_name VARCHAR(255) NOT NULL,
--     file_type VARCHAR(100), -- Увеличена длина для MIME-типов
--     file_size BIGINT,
--     storage_url VARCHAR(1024) NOT NULL UNIQUE, -- URL должен быть уникальным
--     uploaded_by INT NOT NULL, -- ID пользователя из внешней системы
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );
-- COMMENT ON TABLE files_schema.files IS 'Metadata for uploaded files';

-- CREATE TABLE files_schema.equipment_files (
--     -- В этой таблице храним ID оборудования из другой схемы
--     -- Внешний ключ между схемами создавать НЕ РЕКОМЕНДУЕТСЯ для независимости сервисов.
--     -- Целостность будет поддерживаться на уровне логики приложения (при удалении оборудования - вызов API сервиса файлов).
--     equipment_id INT NOT NULL,
--     file_id INT NOT NULL REFERENCES files_schema.files(id) ON DELETE CASCADE, -- Удаляем связь при удалении файла
--     PRIMARY KEY (equipment_id, file_id)
-- );
-- COMMENT ON TABLE files_schema.equipment_files IS 'Link table between equipment (ID only) and files';


-- -- === Индексы ===

-- -- Индексы для equipment_schema
-- CREATE INDEX IF NOT EXISTS idx_equipment_category_id ON equipment_schema.equipment(category_id);
-- CREATE INDEX IF NOT EXISTS idx_equipment_parent_id ON equipment_schema.equipment(parent_id);
-- -- Уникальный индекс на serial_number создается автоматически через UNIQUE constraint
-- CREATE INDEX IF NOT EXISTS idx_equipment_ticket_equipment_id ON equipment_schema.equipment_ticket(equipment_id);
-- CREATE INDEX IF NOT EXISTS idx_equipment_users_equipment_id ON equipment_schema.equipment_users(equipment_id);
-- CREATE INDEX IF NOT EXISTS idx_equipment_company_equipment_id ON equipment_schema.equipment_company(equipment_id);

-- -- Индексы для files_schema
-- CREATE INDEX IF NOT EXISTS idx_equipment_files_file_id ON files_schema.equipment_files(file_id);
-- CREATE INDEX IF NOT EXISTS idx_equipment_files_equipment_id ON files_schema.equipment_files(equipment_id); -- Важен для поиска файлов по ID оборудования
-- -- Уникальный индекс на storage_url создается автоматически через UNIQUE constraint


-- -- === Триггеры ===

-- -- Триггер для автоматического обновления updated_at в equipment_schema.equipment
-- -- Важно: Создаем функцию в схеме public или указываем схему явно
-- CREATE OR REPLACE FUNCTION public.update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = NOW(); -- NOW() возвращает timestamptz
--     RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- -- Применяем триггер к таблице в нужной схеме
-- DROP TRIGGER IF EXISTS update_equipment_updated_at ON equipment_schema.equipment; -- Удаляем старый, если был
-- CREATE TRIGGER update_equipment_updated_at
-- BEFORE UPDATE ON equipment_schema.equipment
-- FOR EACH ROW
-- EXECUTE FUNCTION public.update_updated_at_column();


-- -- === Материализованное Представление (для Сервиса Отчетов) ===
-- -- Представление будет читать данные из equipment_schema
-- -- Его можно создать в equipment_schema или в отдельной схеме reports_schema
-- CREATE MATERIALIZED VIEW IF NOT EXISTS equipment_schema.equipment_report AS
--     SELECT
--         t.ticket_id AS ticket_id,
--         e.id AS equipment_id, -- Добавляем ID оборудования
--         e.name AS equipment_name,
--         t.quantity_used,
--         e.serial_number,
--         c.id AS category_id, -- Добавляем ID категории
--         c.name AS category_name,
--         comp.company_id AS company_id, -- Добавляем ID компании
--         t.recorded_at
--     FROM equipment_schema.equipment_ticket t
--     JOIN equipment_schema.equipment e ON t.equipment_id = e.id
--     JOIN equipment_schema.categories c ON e.category_id = c.id
--     -- Используем LEFT JOIN для компании, если оборудование может быть не привязано к компании
--     LEFT JOIN equipment_schema.equipment_company comp ON e.id = comp.equipment_id;

-- COMMENT ON MATERIALIZED VIEW equipment_schema.equipment_report IS 'Aggregated view for reporting equipment usage in tickets';

-- -- Опционально: Уникальный индекс для REFRESH CONCURRENTLY
-- -- CREATE UNIQUE INDEX IF NOT EXISTS equipment_report_unique_idx ON equipment_schema.equipment_report (ticket_id, equipment_id);

-- -- ВНИМАНИЕ: Таблицу mv_equipment_report создавать НЕ НУЖНО, если вы используете MATERIALIZED VIEW.
-- -- DROP TABLE IF EXISTS equipment_schema.mv_equipment_report; -- Удаляем, если она была создана по ошибке