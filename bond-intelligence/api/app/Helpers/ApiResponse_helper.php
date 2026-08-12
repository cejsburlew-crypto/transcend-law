<?php

if (! function_exists('api_success')) {
    function api_success($data, string $message = '', int $code = 200, ?array $pagination = null): \CodeIgniter\HTTP\Response
    {
        $response = service('response');
        $body = [
            'status'  => 'success',
            'message' => $message,
            'data'    => $data,
            'meta'    => [
                'timestamp' => date('c'),
                'version'   => '1.0',
            ],
        ];
        if ($pagination !== null) {
            $body['meta']['pagination'] = $pagination;
        }
        return $response
            ->setStatusCode($code)
            ->setContentType('application/json')
            ->setJSON($body);
    }
}

if (! function_exists('api_error')) {
    function api_error(string $message, int $code = 400, array $errors = []): \CodeIgniter\HTTP\Response
    {
        $response = service('response');
        return $response
            ->setStatusCode($code)
            ->setContentType('application/json')
            ->setJSON([
                'status'  => 'error',
                'message' => $message,
                'errors'  => $errors,
                'data'    => null,
                'meta'    => ['timestamp' => date('c'), 'version' => '1.0'],
            ]);
    }
}
