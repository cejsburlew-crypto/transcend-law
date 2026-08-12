<?php

declare(strict_types=1);

namespace Transcend\Ssp;

class Router
{
    /** @var array<string, array<string, callable>> */
    private array $routes = [];

    public function get(string $path, callable|array $handler): void
    {
        $this->routes['GET'][$path] = $handler;
    }

    public function post(string $path, callable|array $handler): void
    {
        $this->routes['POST'][$path] = $handler;
    }

    public function put(string $path, callable|array $handler): void
    {
        $this->routes['PUT'][$path] = $handler;
    }

    public function delete(string $path, callable|array $handler): void
    {
        $this->routes['DELETE'][$path] = $handler;
    }

    public function dispatch(string $method, string $path): void
    {
        $routes = $this->routes[$method] ?? [];

        foreach ($routes as $pattern => $handler) {
            $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
            if (!preg_match($regex, $path, $matches)) {
                continue;
            }

            $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
            $this->invoke($handler, $params);
            return;
        }

        http_response_code(404);
        echo json_encode(['error' => 'Not found']);
    }

    /** @param callable|array{class-string, string} $handler */
    private function invoke(callable|array $handler, array $params): void
    {
        if (is_array($handler)) {
            [$class, $method] = $handler;
            (new $class())->$method($params);
            return;
        }

        $handler($params);
    }
}
