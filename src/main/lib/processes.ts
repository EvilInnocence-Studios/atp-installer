import { ChildProcess, spawn } from 'child_process';
import { BrowserWindow } from 'electron';

interface ManagedProcess {
    id: string;
    cp: ChildProcess;
    status: 'running' | 'stopped' | 'error';
}

export class ProcessManager {
    private processes: Map<string, ManagedProcess> = new Map();
    private win: BrowserWindow | null = null;

    setWindow(win: BrowserWindow) {
        this.win = win;
    }

    private log(message: string, type: 'info' | 'error' | 'success', service?: string) {
        if (this.win) {
            this.win.webContents.send('installer-log', {
                message: service ? `[${service}] ${message}` : message,
                type,
                timestamp: new Date().toISOString()
            });
        }
    }

    private updateStatus(id: string, status: 'running' | 'stopped' | 'error') {
        const p = this.processes.get(id);
        if (p) {
            p.status = status;
            if (this.win) {
                this.win.webContents.send('dev:status-update', { id, status });
            }
        }
    }

    async start(id: string, cwd: string, command: string = 'yarn', args: string[] = ['dev']) {
        if (this.processes.has(id) && this.processes.get(id)?.status === 'running') {
            this.log(`${id} is already running.`, 'info');
            return;
        }

        this.log(`Starting ${id}...`, 'info', id);
        
        // Use shell: true for Windows to handle yarn.cmd
        const cp = spawn(command, args, { 
            cwd, 
            shell: true,
            env: { ...process.env, FORCE_COLOR: '1' } 
        });

        this.processes.set(id, { id, cp, status: 'running' });
        this.updateStatus(id, 'running');

        cp.stdout?.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((line: string) => {
                if (line.trim()) this.log(line.trim(), 'info', id);
            });
        });

        cp.stderr?.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((line: string) => {
                if (line.trim()) this.log(line.trim(), 'error', id);
            });
        });

        cp.on('close', (code) => {
            this.log(`${id} exited with code ${code}`, code === 0 ? 'success' : 'error', id);
            this.processes.delete(id);
            this.updateStatus(id, 'stopped');
        });

        cp.on('error', (err) => {
            this.log(`${id} failed to start: ${err.message}`, 'error', id);
            this.processes.delete(id);
            this.updateStatus(id, 'error');
        });
    }

    async stop(id: string) {
        const p = this.processes.get(id);
        if (p && p.cp) {
            this.log(`Stopping ${id}...`, 'info', id);
            // On Windows, taskkill is often more reliable for deep trees (like yarn -> node)
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', p.cp.pid?.toString() || '', '/f', '/t'], { shell: true });
            } else {
                p.cp.kill();
            }
            this.processes.delete(id);
            this.updateStatus(id, 'stopped');
        }
    }

    async restart(id: string, cwd: string, command: string = 'yarn', args: string[] = ['dev']) {
        await this.stop(id);
        // Wait a small moment for port to clear if needed
        await new Promise(r => setTimeout(r, 1000));
        await this.start(id, cwd, command, args);
    }

    stopAll() {
        for (const id of this.processes.keys()) {
            this.stop(id);
        }
    }

    getStatus() {
        const status: Record<string, string> = {};
        this.processes.forEach((p, id) => {
            status[id] = p.status;
        });
        return status;
    }
}

export const processManager = new ProcessManager();
