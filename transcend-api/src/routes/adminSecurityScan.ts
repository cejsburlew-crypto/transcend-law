import { Router, Request, Response } from 'express';

const router = Router();

router.get('/admin/security-scan', (req: Request, res: Response) => {
  res.json({ scan: { status: 'complete', issues: [] } });
});

export default router;
