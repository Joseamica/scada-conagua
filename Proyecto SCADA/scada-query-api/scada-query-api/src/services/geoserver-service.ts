// src/services/geoserver-service.ts
// Client for GeoServer REST API

import fs from 'fs';

const GEOSERVER_URL = process.env.GEOSERVER_URL || 'http://localhost:8600/geoserver';
const GEOSERVER_PUBLIC_URL = process.env.GEOSERVER_PUBLIC_URL || GEOSERVER_URL;
const GEOSERVER_USER = process.env.GEOSERVER_USER || 'admin';
const GEOSERVER_PASS = process.env.GEOSERVER_PASS || 'geoserver';
const WORKSPACE = 'scada';

const authHeader = 'Basic ' + Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASS}`).toString('base64');

async function geoFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${GEOSERVER_URL}/rest${path}`;
    const headers: Record<string, string> = {
        'Authorization': authHeader,
        ...(options.headers as Record<string, string> || {}),
    };
    return fetch(url, { ...options, headers });
}

/**
 * Ensure the 'scada' workspace exists in GeoServer.
 */
export async function ensureWorkspace(): Promise<boolean> {
    try {
        const check = await geoFetch(`/workspaces/${WORKSPACE}`, {
            headers: { 'Accept': 'application/json' },
        });
        if (check.ok) return true;

        const create = await geoFetch('/workspaces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspace: { name: WORKSPACE } }),
        });
        return create.ok || create.status === 409; // 409 = already exists
    } catch (error) {
        console.error('[GeoServer] Failed to ensure workspace:', error);
        return false;
    }
}

/**
 * Upload a zipped shapefile to GeoServer and publish as a layer.
 * Handles ZIPs with multiple shapefiles or subdirectories:
 * - Extracts the ZIP, finds all .shp files
 * - Re-zips each shapefile individually (with .shx, .dbf, .prj)
 * - Publishes each as a separate layer
 */
export async function publishShapefile(
    layerName: string,
    zipFilePath: string
): Promise<{ success: boolean; error?: string; layers?: string[] }> {
    const AdmZip = require('adm-zip');
    try {
        await ensureWorkspace();

        const zip = new AdmZip(zipFilePath);
        const entries = zip.getEntries();

        // Find all .shp files in the ZIP
        const shpEntries = entries.filter((e: any) => e.entryName.toLowerCase().endsWith('.shp'));

        if (shpEntries.length === 0) {
            return { success: false, error: 'El ZIP no contiene archivos .shp' };
        }

        // If ZIP has exactly one shapefile set at root level, upload directly
        if (shpEntries.length === 1 && !shpEntries[0].entryName.includes('/')) {
            const fileBuffer = fs.readFileSync(zipFilePath);
            const res = await geoFetch(
                `/workspaces/${WORKSPACE}/datastores/${layerName}/file.shp`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/zip' },
                    body: fileBuffer,
                }
            );
            if (res.ok || res.status === 201) {
                return { success: true, layers: [layerName] };
            }
            const text = await res.text();
            return { success: false, error: `GeoServer: ${res.status} — ${text}` };
        }

        // Multiple shapefiles or in subdirectories — re-zip each individually
        const published: string[] = [];
        const errors: string[] = [];

        for (const shpEntry of shpEntries) {
            const baseName = shpEntry.entryName.replace(/\.shp$/i, '');
            const dir = baseName.includes('/') ? baseName.substring(0, baseName.lastIndexOf('/') + 1) : '';
            const stem = baseName.includes('/') ? baseName.substring(baseName.lastIndexOf('/') + 1) : baseName;

            // Collect related files (.shx, .dbf, .prj, .cpg)
            const relatedExts = ['.shp', '.shx', '.dbf', '.prj', '.cpg'];
            const newZip = new AdmZip();

            for (const ext of relatedExts) {
                const relatedName = baseName + ext;
                const relatedNameUpper = baseName + ext.toUpperCase();
                const entry = entries.find((e: any) =>
                    e.entryName === relatedName || e.entryName === relatedNameUpper
                );
                if (entry) {
                    // Add at root level (no subdirectory) with the stem name
                    newZip.addFile(stem + ext, entry.getData());
                }
            }

            const singleLayerName = stem.toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 64);
            const tempZipPath = zipFilePath + `_${singleLayerName}.zip`;
            newZip.writeZip(tempZipPath);

            const fileBuffer = fs.readFileSync(tempZipPath);
            try {
                const res = await geoFetch(
                    `/workspaces/${WORKSPACE}/datastores/${singleLayerName}/file.shp`,
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/zip' },
                        body: fileBuffer,
                    }
                );

                if (res.ok || res.status === 201) {
                    published.push(singleLayerName);
                } else {
                    const text = await res.text();
                    errors.push(`${singleLayerName}: ${res.status} — ${text}`);
                }
            } finally {
                if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
            }
        }

        if (published.length > 0) {
            return {
                success: true,
                layers: published,
                error: errors.length > 0 ? `Algunas capas fallaron: ${errors.join('; ')}` : undefined,
            };
        }
        return { success: false, error: errors.join('; ') || 'No se pudo publicar ninguna capa.' };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * List all published layers in the scada workspace.
 */
export async function listLayers(): Promise<{
    name: string;
    href: string;
    type?: string;
}[]> {
    try {
        const res = await geoFetch(`/workspaces/${WORKSPACE}/layers`, {
            headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
            if (res.status === 404) return []; // Workspace has no layers
            return [];
        }

        const data = await res.json() as any;
        const layers = data?.layers?.layer;
        if (!Array.isArray(layers)) return [];

        return layers.map((l: any) => ({
            name: l.name,
            href: l.href || '',
        }));
    } catch (error) {
        console.error('[GeoServer] Failed to list layers:', error);
        return [];
    }
}

/**
 * Get layer details including bounding box and SRS.
 */
export async function getLayerDetails(layerName: string): Promise<any | null> {
    try {
        const res = await geoFetch(
            `/workspaces/${WORKSPACE}/layers/${layerName}`,
            { headers: { 'Accept': 'application/json' } }
        );
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Delete a layer and its datastore from GeoServer.
 */
export async function deleteLayer(layerName: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Delete the layer first
        await geoFetch(`/workspaces/${WORKSPACE}/layers/${layerName}?recurse=true`, {
            method: 'DELETE',
        });

        // Then delete the datastore
        const dsRes = await geoFetch(
            `/workspaces/${WORKSPACE}/datastores/${layerName}?recurse=true`,
            { method: 'DELETE' }
        );

        if (dsRes.ok || dsRes.status === 404) {
            return { success: true };
        }

        const text = await dsRes.text();
        return { success: false, error: `GeoServer responded ${dsRes.status}: ${text}` };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Get the WMS URL for a specific layer.
 */
export function getWmsUrl(): string {
    return `${GEOSERVER_PUBLIC_URL}/wms`;
}

/**
 * Check if GeoServer is reachable.
 */
export async function healthCheck(): Promise<boolean> {
    try {
        const res = await geoFetch('/about/version', {
            headers: { 'Accept': 'application/json' },
        });
        return res.ok;
    } catch {
        return false;
    }
}
