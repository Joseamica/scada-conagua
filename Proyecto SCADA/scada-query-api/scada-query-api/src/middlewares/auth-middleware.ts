import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env['JWT_SECRET'] as string;

// Roles del sistema SCADA (SOA spec)
// 1 = Administrador — acceso total
// 2 = Supervisor    — lectura + control, sin gestión de usuarios
// 3 = Operador      — lectura + control de su municipio
// 4 = Tecnico       — solo lectura (dashboards y reportes)

export const isAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Acceso denegado. No se proporciono el token.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Token invalido o ya expiró.' });
    }
};

// Solo Admin (role_id = 1)
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    isAuth(req, res, () => {
        if (req.user?.role_id === 1) {
            next();
        } else {
            res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Administrador.' });
        }
    });
};

// Admin o Supervisor (role_id <= 2)
export const isSupervisor = (req: Request, res: Response, next: NextFunction) => {
    isAuth(req, res, () => {
        if ((req.user?.role_id ?? 99) <= 2) {
            next();
        } else {
            res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Supervisor o superior.' });
        }
    });
};

// Admin, Supervisor u Operador (role_id <= 3)
export const isOperator = (req: Request, res: Response, next: NextFunction) => {
    isAuth(req, res, () => {
        if ((req.user?.role_id ?? 99) <= 3) {
            next();
        } else {
            res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Operador o superior.' });
        }
    });
};
