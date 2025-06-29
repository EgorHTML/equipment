import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class Equipment_finite {
    @PrimaryColumn()
    id: number

    @Column()
    quantity: number
}
