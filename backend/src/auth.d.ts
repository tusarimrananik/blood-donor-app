import type { NextFunction, Request, Response } from "express";
type AuthTokenPayload = {
    userId: string;
    email: string;
    exp: number;
};
export type AuthUser = {
    id: string;
    name: string;
    email: string;
    phone: string;
    bloodGroup: string;
    area: string;
    lastDonated: Date;
    gender: string | null;
    dateOfBirth: Date | null;
    profileImage: string | null;
    canDonate: boolean;
    lat: number;
    lon: number;
    createdAt: Date;
    updatedAt: Date;
};
export type AuthedRequest = Request & {
    authUser?: AuthUser;
};
export declare function hashPassword(password: string): string;
export declare function verifyPassword(password: string, storedHash: string | null | undefined): boolean;
export declare function signToken(userId: string, email: string): string;
export declare function verifyToken(token: string): AuthTokenPayload | null;
export declare function loadAuthUserById(userId: string): Promise<AuthUser | null>;
export declare function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function attachAuthUser(req: AuthedRequest): Promise<AuthUser | null>;
export {};
//# sourceMappingURL=auth.d.ts.map