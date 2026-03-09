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
 * The zip must contain .shp, .shx, .dbf, and .prj files.
 */
export async function publishShapefile(
    layerName: string,
    zipFilePath: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureWorkspace();

        const fileBuffer = fs.readFileSync(zipFilePath);

        // Upload shapefile to create datastore + layer in one step
        const res = await geoFetch(
            `/workspaces/${WORKSPACE}/datastores/${layerName}/file.shp`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/zip' },
                body: fileBuffer,
            }
        );

        if (res.ok || res.status === 201) {
            return { success: true };
        }

        const text = await res.text();
        return { success: false, error: `GeoServer responded ${res.status}: ${text}` };
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
