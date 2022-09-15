import { makeProjection, Projection, StaticProjectionEventHandler, Uuid } from '@hyprnz/es-domain';
import { AlarmCreatedEvent, AlarmDestroyedEvent } from './Device';

export interface AlarmProjection extends Projection {  
  name: string
}

const eventHandlers: Record<string, StaticProjectionEventHandler<AlarmProjection>> = {
  [AlarmCreatedEvent.eventType]: (state, evt) => {
    AlarmCreatedEvent.assertAlarmCreatedEvent(evt)
    state.name = evt.name
    return 'update'
  },  
  [AlarmDestroyedEvent.eventType]: (state, evt) => 'delete'
}

const defaultValue = (id: Uuid.UUID): AlarmProjection => ({
  id,
  version: 0,
  name: "Unknown",
})

export const ALARM_PROJECTION = 'alarm'
export const alarmProjection = makeProjection<AlarmProjection>(
  ALARM_PROJECTION,
  eventHandlers,
  defaultValue,
  evt => evt.entityId
)

