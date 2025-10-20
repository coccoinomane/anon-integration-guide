import { http, type HttpTransportConfig } from 'viem';

/**
 * Creates an HTTP transport for Viem that logs all requests and responses
 * to the console. Useful for debugging blockchain interactions.
 */
export function httpWithLogging(url?: string) {
    const config: HttpTransportConfig = {
        onFetchRequest: async (request: Request) => {
            // Clone the request to read the body without consuming it
            const clonedRequest = request.clone();
            let bodyContent;
            try {
                const bodyText = await clonedRequest.text();
                bodyContent = bodyText ? JSON.parse(bodyText) : undefined;
            } catch (e) {
                bodyContent = '[Could not parse body]';
            }

            console.log(`🔵 Viem Request at ${new Date().toISOString()}:`, request.url, bodyContent?.method ?? '');
        },
        onFetchResponse: (response: Response) => {
            console.log(`🟢 Viem Response at ${new Date().toISOString()}:`, response.url, response.status, response.statusText);
        },
    };

    return http(url, config);
}
