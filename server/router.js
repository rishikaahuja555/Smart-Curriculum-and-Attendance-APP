export function createRouter() {
  const routes = [];

  const addRoute = (method, path, handler) => {
    routes.push({ method, path, handler });
    return { method, path, handler };
  };

  return {
    get(path, handler) {
      return addRoute('GET', path, handler);
    },
    post(path, handler) {
      return addRoute('POST', path, handler);
    },
    put(path, handler) {
      return addRoute('PUT', path, handler);
    },
    delete(path, handler) {
      return addRoute('DELETE', path, handler);
    },
    async dispatch(request, response, url, context = {}) {
      const route = routes.find((entry) => {
        if (entry.method !== request.method) return false;
        if (entry.path instanceof RegExp) return entry.path.test(url.pathname);
        return entry.path === url.pathname;
      });

      if (!route) return false;

      const match = route.path instanceof RegExp ? route.path.exec(url.pathname) : null;
      const params = match ? match.slice(1) : [];
      await route.handler({ request, response, url, params, ...context });
      return true;
    }
  };
}

export function bindApiHandler(handler) {
  return {
    handleApi: handler,
    dispatch: handler
  };
}
