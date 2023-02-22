import { projection, Projection, Uuid } from '@hyprnz/es-domain';
import { AlarmCreatedEvent, AlarmDestroyedEvent } from './Device';

export interface AlarmProjection extends Projection {
  name: string
}

const eventHandlers: Record<string, projection.StaticProjectionEventHandler<AlarmProjection>> = {
  [AlarmCreatedEvent.eventType]: (state, evt) => {
    AlarmCreatedEvent.assertAlarmCreatedEvent(evt)
    state.name = evt.name
    return 'update'
  },
  [AlarmDestroyedEvent.eventType]: (state, evt) => 'delete'
}

const iniialValue = (id: Uuid.UUID): AlarmProjection => ({
  id,
  version: 0,
  name: "Unknown",
})

export const ALARM_PROJECTION = 'alarm'
export const alarmProjection = projection.makeProjection<AlarmProjection>(
  ALARM_PROJECTION,
  eventHandlers,
  iniialValue,
  evt => evt.entityId
)

