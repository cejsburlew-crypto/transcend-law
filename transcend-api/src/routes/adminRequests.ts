import { Router, Request, Response } from 'express';

const router = Router();

router.get('/admin/requests', (req: Request, res: Response) => {
  res.json({ requests: [] });
});

export default router;
