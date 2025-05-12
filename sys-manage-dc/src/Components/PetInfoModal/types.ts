// types.ts
export interface PetType {
    id: string;
    age: number;
    breed: string;
    gender: string;
    healthStatus: string;
    lastCheckHealthDate: string;
    lastModifiedBy: string;
    lastUpdateTime: string;
    lastVaccineDate: string;
    lastViolationDate: string;
    name: string;
    species: string;
    vaccinationStatus: string;
    violationStatus: string;
    ownerId: string;
    imageUrl?: string;
}

export interface OwnerType {
    id: string;
    address: string;
    birthday: string;
    cccd: string;
    email: string;
    fullName: string;
    phone: string;
    sex: string;
    updateAt: string;
    avatarUrl?: string;
}