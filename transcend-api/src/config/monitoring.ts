// Monitoring Configuration
// Sentry + performance tracking

export function setupMonitoring(app: any) {
  // Performance tracking middleware
  app.use((req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      // Log slow requests
      if (duration > 500) {
        console.warn(`⚠️  Slow: ${req.method} ${req.path} - ${duration}ms`);
      }
    });
    
    next();
  });

  console.log('✅ Monitoring configured');
}
