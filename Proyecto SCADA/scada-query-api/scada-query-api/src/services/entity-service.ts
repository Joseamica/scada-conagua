import { pool } from './db-service';
import { IEntity, ICreateEntityRequest } from '../interfaces/entity.interface';

export const getAllEntities = async (): Promise<IEntity[]> => {
    const result = await pool.query(
        `SELECT id, name, level, parent_id, estado_id, municipio_id, is_active, created_at
         FROM scada.entities
         WHERE is_active = true
         ORDER BY level, name`
    );
    return result.rows;
};

export const getScopedEntities = async (
    scope: string,
    estadoId: number,
    scopeId: number
): Promise<IEntity[]> => {
    if (scope === 'Federal') {
        return getAllEntities();
    }

    if (scope === 'Estatal') {
        const result = await pool.query(
            `SELECT id, name, level, parent_id, estado_id, municipio_id, is_active, created_at
             FROM scada.entities
             WHERE is_active = true
               AND (estado_id = $1 OR level = 'Federal')
             ORDER BY level, name`,
            [estadoId]
        );
        return result.rows;
    }

    // Municipal: show own municipality + parent chain
    const result = await pool.query(
        `WITH RECURSIVE chain AS (
            SELECT id, name, level, parent_id, estado_id, municipio_id, is_active, created_at
            FROM scada.entities
            WHERE municipio_id = $1 AND estado_id = $2 AND level = 'Municipal'
          UNION ALL
            SELECT e.id, e.name, e.level, e.parent_id, e.estado_id, e.municipio_id, e.is_active, e.created_at
            FROM scada.entities e
            INNER JOIN chain c ON e.id = c.parent_id
        )
        SELECT * FROM chain WHERE is_active = true
        ORDER BY level, name`,
        [scopeId, estadoId]
    );
    return result.rows;
};

export const createEntity = async (data: ICreateEntityRequest): Promise<number> => {
    const { name, level, parent_id, estado_id, municipio_id } = data;
    const result = await pool.query(
        `INSERT INTO scada.entities (name, level, parent_id, estado_id, municipio_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [name, level, parent_id || null, estado_id || 0, municipio_id || 0]
    );
    return result.rows[0].id;
};
