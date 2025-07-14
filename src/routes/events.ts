import { Router } from 'express';
import { bus } from '../progressBus';

const router = Router();

/** Server-Sent Events endpoint – streams JSON progress objects */
router.get('/events', (req, res) => {
    res.set({
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive'
    });

    const send = (data: any) =>
        res.write(`data: ${JSON.stringify(data)}\n\n`);

    const listener = (d: any) => send(d);
    bus.on('progress', listener);

    req.on('close', () => bus.off('progress', listener));
});

export default router;
