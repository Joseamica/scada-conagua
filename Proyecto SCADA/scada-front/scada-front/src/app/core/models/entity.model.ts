export interface Entity {
  id: number;
  name: string;
  level: 'Federal' | 'Estatal' | 'Municipal';
  parent_id: number | null;
  estado_id: number;
  municipio_id: number;
  is_active: boolean;
  created_at?: string;
}

export interface EntityTreeNode {
  entity: Entity;
  children: EntityTreeNode[];
}
