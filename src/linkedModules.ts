import * as path from 'path';

import * as fs from 'fs';
import * as util from 'util';

const readdir = util.promisify(fs.readdir);
const readlink = util.promisify(fs.readlink);
const lstat = util.promisify(fs.lstat);


export interface ILinkedModule {
    name: string;
    actualPath: string;
}

export async function hasLinkedModules(rootPath: string): Promise<boolean> {
    // TODO
    return (await getLinkedModules(rootPath)).length > 0;
}

export async function getLinkedModules(rootPath: string): Promise<ILinkedModule[]> {
    return _getLinkedModules(path.join(rootPath, 'node_modules'));
}

async function _getLinkedModules(nodeModulesDir: string): Promise<ILinkedModule[]> {
    let modules: string[];
    try {
        modules = await readdir(nodeModulesDir);
    } catch (e) {
        return [];
    }

    const linkedModules = await _getLinkedModulesFromDir(nodeModulesDir, modules);
    for (let m of modules) {
        if (m.startsWith('@')) {
            linkedModules.push(... await _getLinkedModules(path.join(nodeModulesDir, m)));
        }
    }

    return linkedModules;
}

async function _getLinkedModulesFromDir(nodeModulesDir: string, modules: string[]): Promise<any> {
    const results = await Promise.all(
        modules.map(async m => {
            const absPath = path.join(nodeModulesDir, m);
            if (await isLinked(absPath)) {
                return <ILinkedModule>{
                    name: m,
                    actualPath: await _getSymlinkTarget(absPath)
                };
            } else {
                return null;
            }
        }));
    return results.filter(result => !!result);
}

async function _getSymlinkTarget(folderPath: string): Promise<string> {
    const target = await readlink(folderPath);
    const absTarget = path.resolve(folderPath, '..', target);
    if (await isLinked(absTarget)) {
        return _getSymlinkTarget(absTarget);
    }

    return absTarget;
}

async function isLinked(folderPath: string): Promise<boolean> {
    try {
        const stat: fs.Stats = await lstat(folderPath);
        return stat.isSymbolicLink();
    } catch (e) {
        return false;
    }
}