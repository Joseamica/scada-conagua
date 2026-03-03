export interface IEntity {
    id: number;
    name: string;
    level: 'Federal' | 'Estatal' | 'Municipal';
    parent_id: number | null;
    estado_id: number;
    municipio_id: number;
    is_active: boolean;
    created_at?: Date;
}

export interface ICreateEntityRequest {
    name: string;
    level: 'Federal' | 'Estatal' | 'Municipal';
    parent_id?: number;
    estado_id?: number;
    municipio_id?: number;
}
