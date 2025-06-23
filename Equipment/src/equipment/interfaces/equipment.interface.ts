export class IEquipment {
    id: number;

    children: IEquipment[]

    parent:IEquipment | null

    category_id: number;

    name: string;

    serial_number: string;

    warranty_end: number | null;

    article: string | null;

    description: string | null;

    created_at: number;

    updated_at: number;
}

export interface IEquipment_finite extends IEquipment {
    quantity: number | null
}

export type IEquipment_overall = IEquipment | IEquipment_finite
