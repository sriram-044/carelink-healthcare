# ==============================================================================
# CareLink AI Healthcare Ecosystem — Frontend Web Service (Nginx)
# ==============================================================================
FROM nginx:alpine

# Remove default configuration
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration with API proxy rules
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy static frontend assets (HTML, CSS, JS)
COPY frontend/ /usr/share/nginx/html/

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
