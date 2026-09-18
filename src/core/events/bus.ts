/**
 * Enlace ERP - Event Bus Desacoplado
 * PRD 01 - Seção 21 (Eventos Internos de Domínio)
 */

import { EventEmitter } from 'events';
import { logger } from '../logger/index.js';

export interface DomainEvent<T = unknown> {
  eventId: string;
  eventType: string;
  timestamp: string;
  companyId?: string;
  userId?: string;
  payload: T;
}

class AppEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  publish<T>(eventType: string, payload: T, meta?: { companyId?: string; userId?: string }) {
    const event: DomainEvent<T> = {
      eventId: crypto.randomUUID(),
      eventType,
      timestamp: new Date().toISOString(),
      companyId: meta?.companyId,
      userId: meta?.userId,
      payload,
    };

    logger.debug(`[EventBus] Publicado: ${eventType}`, { eventId: event.eventId, companyId: meta?.companyId });
    this.emitter.emit(eventType, event);
    this.emitter.emit('*', event);
  }

  subscribe<T>(eventType: string, handler: (event: DomainEvent<T>) => void | Promise<void>) {
    this.emitter.on(eventType, async (event: DomainEvent<T>) => {
      try {
        await handler(event);
      } catch (err) {
        logger.error(`[EventBus] Erro ao processar evento ${eventType}`, err as Error, { eventId: event.eventId });
      }
    });
  }
}

export const eventBus = new AppEventBus();
