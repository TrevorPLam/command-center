---
description: Run Performance Optimization Workflow
---

# Performance Optimization Workflow

This workflow provides a systematic approach to optimizing application performance across frontend, backend, and infrastructure layers.

## Step 1: Performance Baseline

Establish current performance metrics and identify bottlenecks:

1. **Frontend Performance**
   - Measure Core Web Vitals (LCP, FID, CLS)
   - Analyze bundle size and loading times
   - Check render-blocking resources
   - Measure Time to Interactive (TTI)

2. **Backend Performance**
   - Measure API response times
   - Analyze database query performance
   - Check server resource utilization
   - Monitor memory usage patterns

3. **Infrastructure Performance**
   - Measure CDN hit ratios
   - Analyze cache effectiveness
   - Check network latency
   - Monitor server response times

## Step 2: Frontend Optimization

Optimize client-side performance:

1. **Bundle Optimization**
   - Implement code splitting and lazy loading
   - Remove unused dependencies
   - Optimize imports and tree shaking
   - Minify and compress assets

2. **Rendering Optimization**
   - Implement virtual scrolling for large lists
   - Use React.memo and useMemo appropriately
   - Optimize re-renders
   - Implement loading states and skeletons

3. **Asset Optimization**
   - Optimize images with Next.js Image component
   - Implement font optimization
   - Use CDN for static assets
   - Enable Brotli compression

## Step 3: Backend Optimization

Optimize server-side performance:

1. **Database Optimization**
   - Add proper indexes for query patterns
   - Implement query result caching
   - Optimize N+1 queries
   - Use connection pooling

2. **API Optimization**
   - Implement response caching
   - Use pagination for large datasets
   - Optimize serialization
   - Implement compression

3. **Compute Optimization**
   - Use background jobs for heavy tasks
   - Implement async processing
   - Optimize algorithms and data structures
   - Use appropriate data types

## Step 4: Infrastructure Optimization

Optimize deployment and infrastructure:

1. **CDN Optimization**
   - Configure proper cache headers
   - Implement edge caching
   - Use geographic distribution
   - Optimize cache invalidation

2. **Server Optimization**
   - Use appropriate server sizing
   - Implement load balancing
   - Configure auto-scaling
   - Optimize container resources

3. **Network Optimization**
   - Minimize HTTP requests
   - Use HTTP/2 or HTTP/3
   - Implement connection keep-alive
   - Optimize DNS resolution

## Step 5: Monitoring and Measurement

Continuously monitor performance improvements:

1. **Real User Monitoring (RUM)**
   - Track Core Web Vitals
   - Monitor user experience metrics
   - Analyze performance by geography
   - Track performance over time

2. **Synthetic Monitoring**
   - Run performance tests regularly
   - Monitor API response times
   - Test third-party service performance
   - Validate SLA compliance

3. **Alerting and Reporting**
   - Set performance alerts
   - Generate performance reports
   - Track optimization impact
   - Monitor regression

## Performance Checklist

### Frontend Performance

- [ ] Bundle size under 200KB (gzipped)
- [ ] LCP under 2.5s
- [ ] FID under 100ms
- [ ] CLS under 0.1
- [ ] TTI under 3.8s
- [ ] Images optimized with proper dimensions
- [ ] Fonts optimized with display swap
- [ ] Code splitting implemented

### Backend Performance

- [ ] API response times under 200ms (p95)
- [ ] Database queries under 100ms (p95)
- [ ] Cache hit ratio above 80%
- [ ] Memory usage under 80% of allocation
- [ ] CPU usage under 70% average
- [ ] Connection pooling configured
- [ ] Query optimization completed

### Infrastructure Performance

- [ ] CDN hit ratio above 90%
- [ ] Server response times under 100ms
- [ ] Network latency under 50ms
- [ ] Auto-scaling configured
- [ ] Load balancing active
- [ ] Compression enabled

## Performance Targets

### Mobile Targets

- **LCP**: < 2.5s
- **FID**: < 100ms
- **CLS**: < 0.1
- **Bundle Size**: < 150KB gzipped

### Desktop Targets

- **LCP**: < 1.5s
- **FID**: < 50ms
- **CLS**: < 0.05
- **Bundle Size**: < 200KB gzipped

### API Targets

- **Response Time**: < 200ms (p95)
- **Throughput**: > 1000 RPS
- **Error Rate**: < 0.1%
- **Uptime**: > 99.9%

## Tools and Commands

### Frontend Performance

```bash
# Bundle analysis
npm run analyze

# Lighthouse audit
npm run lighthouse

# Performance testing
npm run test:performance

# Bundle size check
npm run size-limit
```

### Backend Performance

```bash
# Load testing
npm run test:load

# Database analysis
npm run analyze:db

# Cache analysis
npm run analyze:cache

# Profiling
npm run profile
```

### Infrastructure Performance

```bash
# CDN analysis
npm run analyze:cdn

# Network testing
npm run test:network

# Server monitoring
npm run monitor:server

# Performance monitoring
npm run monitor:perf
```

## Performance Budgets

### Bundle Size Budget

```json
{
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "200kb",
      "maximumError": "250kb"
    },
    {
      "type": "anyComponentStyle",
      "maximumWarning": "2kb",
      "maximumError": "5kb"
    }
  ]
}
```

### Performance Budget

```json
{
  "performance": {
    "lcp": { "warning": 2.5, "error": 4.0 },
    "fid": { "warning": 100, "error": 300 },
    "cls": { "warning": 0.1, "error": 0.25 }
  }
}
```

## Optimization Techniques

### Frontend Techniques

1. **Code Splitting**: Split code by routes and features
2. **Lazy Loading**: Load components on demand
3. **Image Optimization**: Use modern formats and responsive images
4. **Font Optimization**: Use font-display: swap
5. **Caching**: Implement proper browser caching

### Backend Techniques

1. **Database Indexing**: Add indexes for frequent queries
2. **Query Optimization**: Use efficient query patterns
3. **Caching**: Implement multi-layer caching
4. **Connection Pooling**: Reuse database connections
5. **Async Processing**: Use background jobs for heavy tasks

### Infrastructure Techniques

1. **CDN**: Distribute content globally
2. **Edge Computing**: Process requests closer to users
3. **Load Balancing**: Distribute traffic efficiently
4. **Auto-scaling**: Adjust resources based on demand
5. **Compression**: Reduce data transfer size

## Monitoring and Alerting

### Key Metrics

- Core Web Vitals
- API response times
- Database query performance
- Server resource utilization
- Network latency
- Error rates

### Alert Thresholds

- LCP > 4.0s
- API response time > 500ms
- Database query time > 200ms
- Server CPU > 80%
- Memory usage > 90%
- Error rate > 1%

## Review Frequency

- **Daily**: Performance monitoring and alerts
- **Weekly**: Performance report and analysis
- **Monthly**: Performance optimization review
- **Quarterly**: Performance budget adjustment

Remember: Performance optimization is an ongoing process. Regular monitoring and optimization are essential to maintain high performance standards.
