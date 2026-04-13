import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let serverMessage = '';

    // Handle different types of exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        serverMessage = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || responseObj.error || 'HTTP Exception';
        serverMessage = responseObj.message || responseObj.error || exception.message;
        
        // Handle validation errors
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message.join(', ');
          serverMessage = responseObj.message.join(', ');
        }
      }
    } else if (exception instanceof QueryFailedError) {
      // Handle database errors
      status = HttpStatus.BAD_REQUEST;
      const dbError = exception as any;
      
      // Handle specific PostgreSQL errors
      if (dbError.code === '23505') {
        message = 'Duplicate entry. This record already exists.';
        serverMessage = `Duplicate key violation: ${dbError.detail}`;
      } else if (dbError.code === '23503') {
        message = 'Cannot delete or update due to existing references.';
        serverMessage = `Foreign key constraint violation: ${dbError.detail}`;
      } else if (dbError.code === '23502') {
        message = 'Required field is missing.';
        serverMessage = `Not null constraint violation: ${dbError.detail}`;
      } else if (dbError.code === '22P02') {
        message = 'Invalid data format.';
        serverMessage = `Invalid input syntax: ${dbError.message}`;
      } else {
        message = 'Database operation failed.';
        serverMessage = dbError.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message || 'Unknown error occurred';
      serverMessage = exception.message;
    }

    // Log the error with context
    const errorLog = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode: status,
      message: serverMessage,
      stack: exception instanceof Error ? exception.stack : undefined,
      userAgent: request.get('User-Agent'),
      ip: request.ip,
      userId: (request as any).user?.id,
    };

    // Log based on severity
    if (status >= 500) {
      this.logger.error('Server Error:', errorLog);
    } else if (status >= 400) {
      this.logger.warn('Client Error:', errorLog);
    } else {
      this.logger.log('Request Error:', errorLog);
    }

    // Send response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      serverMessage,
      // Only include stack trace in development
      ...(process.env.NODE_ENV === 'development' && {
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    };

    response.status(status).json(errorResponse);
  }
}