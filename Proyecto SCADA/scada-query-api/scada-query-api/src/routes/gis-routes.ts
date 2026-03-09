// src/routes/gis-routes.ts
// API routes for GIS layer management via GeoServer

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { isAuth, isAdmin } from '../middlewares/auth-middleware';
import { auditLog } from '../services/audit-service';
import {
    listLayers,
    publishShapefile,
    deleteLayer,
    getLayerDetails,
    getWmsUrl,
    healthCheck,
} from '../services/geoserver-service';

const router = Router();

// Temp directory for shapefile uploads
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'shapefiles');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
    dest: UPLOAD_DIR,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.zip') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos ZIP con shapefiles (.shp, .shx, .dbf, .prj).'));
        }
    },
});

// GET /api/v1/gis/health — Check GeoServer connectivity
router.get('/health', isAuth, async (_req: Request, res: Response) => {
    const ok = await healthCheck();
    res.json({ geoserver: ok ? 'online' : 'offline', wmsUrl: getWmsUrl() });
});

// GET /api/v1/gis/layers — List all published layers
router.get('/layers', isAuth, async (_req: Request, res: Response) => {
    try {
        const layers = await listLayers();
        res.json({
            wmsUrl: getWmsUrl(),
            layers,
        });
    } catch (e) {
        console.error('[GIS] Error listing layers:', e);
        res.status(500).json({ error: 'Error al listar capas de GeoServer.' });
    }
});

// GET /api/v1/gis/layers/:name — Get layer details
router.get('/layers/:name', isAuth, async (req: Request, res: Response) => {
    const { name } = req.params;
    try {
        const details = await getLayerDetails(name);
        if (!details) {
            return res.status(404).json({ error: 'Capa no encontrada.' });
        }
        res.json(details);
    } catch (e) {
        console.error('[GIS] Error getting layer details:', e);
        res.status(500).json({ error: 'Error al obtener detalles de la capa.' });
    }
});

// POST /api/v1/gis/layers — Upload and publish a shapefile
router.post('/layers', isAdmin, (req: Request, res: Response, next: Function) => {
    upload.single('shapefile')(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'El archivo no puede exceder 50 MB.' });
            }
            return res.status(400).json({ error: err.message });
        }
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, async (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se envio ningun archivo.' });
    }

    const layerName = (req.body.layer_name || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .substring(0, 64);

    if (!layerName) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'layer_name es obligatorio.' });
    }

    try {
        const result = await publishShapefile(layerName, req.file.path);

        // Clean up temp file
        fs.unlinkSync(req.file.path);

        if (result.success) {
            await auditLog(
                req.user!.id,
                'GIS_LAYER_PUBLISHED',
                { layer_name: layerName, original_file: req.file.originalname },
                req.ip!
            );
            res.status(201).json({
                message: `Capa '${layerName}' publicada exitosamente.`,
                layer_name: layerName,
                wms_url: getWmsUrl(),
                wms_layer: `scada:${layerName}`,
            });
        } else {
            res.status(500).json({ error: result.error || 'Error al publicar capa en GeoServer.' });
        }
    } catch (e: any) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.error('[GIS] Error publishing shapefile:', e);
        res.status(500).json({ error: 'Error interno al publicar la capa.' });
    }
});

// DELETE /api/v1/gis/layers/:name — Remove a published layer
router.delete('/layers/:name', isAdmin, async (req: Request, res: Response) => {
    const { name } = req.params;

    try {
        const result = await deleteLayer(name);

        if (result.success) {
            await auditLog(
                req.user!.id,
                'GIS_LAYER_DELETED',
                { layer_name: name },
                req.ip!
            );
            res.json({ message: `Capa '${name}' eliminada.` });
        } else {
            res.status(500).json({ error: result.error || 'Error al eliminar capa.' });
        }
    } catch (e) {
        console.error('[GIS] Error deleting layer:', e);
        res.status(500).json({ error: 'Error interno al eliminar la capa.' });
    }
});

export default router;
