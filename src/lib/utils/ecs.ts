import * as ss from 'superstruct';
import { randomStr, assertPresentOrWarn } from './utils';

class ECS<ComponentMapT extends Record<string, any>> {
  private entities: Entity[] = [];
  private sids: Map<string, EntityRef> = new Map();
  private freeIndices: number[] = [];
  private entityComponents: Record<string, GenerationalArray<ComponentMapT[keyof ComponentMapT]>> = {};

  allocate(): EntityRef {
    if (this.freeIndices.length >= 1) {
      const index = this.freeIndices.shift();
      const entity = this.entities[index];
      entity.generation++;
      entity.alive = true;
      return [index, entity.generation];
    } else {
      const generation = 0;
      const index = this.entities.push({ generation, alive: true, sids: [] }) - 1;
      return [index, generation];
    }
  }

  deallocate(ref: EntityRef): boolean {
    const entity = this.getEntity(ref);
    const [index] = ref;

    if (!entity) return false;

    entity.alive = false;
    entity.sids.forEach(sid => {
      this.sids.delete(sid);
    });
    entity.sids = [];
    this.freeIndices.push(index);

    // garbage collect
    Object.entries(this.entityComponents).forEach(([_, array]) => {
      array.rm(index);
    });

    return true;
  }

  setComponent<K extends keyof ComponentMapT>(ref: EntityRef, componentName: string & K, componentValue: ComponentMapT[K]): boolean {
    if (!this.getEntity(ref)) return false;
    const [index, generation] = ref;

    this.getComponentGenerationalArray(componentName).set(index, generation, componentValue);
    return true;
  }

  getComponent<K extends keyof ComponentMapT>(ref: EntityRef, componentName: string & K): ComponentMapT[K] | null {
    if (!this.getEntity(ref)) return null;
    const [index, generation] = ref;
    return this.getComponentGenerationalArray(componentName).get(index, generation) as ComponentMapT[K];
  }

  getComponentEntities<K extends keyof ComponentMapT>(componentName: string & K): [EntityRef, ComponentMapT[K]][] {
    return this.getComponentGenerationalArray(componentName).entries().map(([index, generation, component]) => (
      [index, this.entities[index], generation, component] as [number, Entity, number, ComponentMapT[K]]
    )).filter(([_index, { generation, alive }, componentGeneration, _component]) => (
      alive && generation === componentGeneration
    )).map(([index, { generation }, _componentGeneration, component]) => (
      [[index, generation], component]
    ))
  }

  getEntityComponents(ref: EntityRef): EntityComponents<ComponentMapT> | null {
    if (!this.getEntity(ref)) return null;
    return new EntityComponents(ref, this);
  }

  getPrimarySid(ref: EntityRef, assertExist: boolean = false): Sid | null {
    const primarySid = this.getEntity(ref)?.sids[0];
    if (assertExist && !primarySid) {
      console.warn('ECS.getPrimarySid: asserted but no Sid related or valid entity found');
      return null;
    }
    return primarySid;
  }

  getOrAddPrimarySid(ref: EntityRef): Sid | null {
    const entity = this.getEntity(ref);
    if (assertPresentOrWarn([entity], 'ECS.getOrAddPrimarySid: valid entity not found')) {
      return null;
    }
    if (entity.sids.length <= 0) {
      return this.genAddSidToEntity(entity, ref);
    }
    return entity.sids[0];
  }

  getAllSids(ref: EntityRef): Sid[] {
    return [...this.getEntity(ref)?.sids];
  }

  addSid(ref: EntityRef, assignedSid: Sid = null, makePrimary: boolean = false): Sid | null {
    const entity = this.getEntity(ref);
    if (assertPresentOrWarn([entity], 'ECS.addSid: valid entity not found')) {
      return null;
    }
    return this.genAddSidToEntity(entity, ref, assignedSid, makePrimary);
  }

  fromSid(sid: Sid, noAllocation: boolean = false): EntityRef | null {
    let ref = this.sids.get(sid);
    if (!this.getEntity(ref) && !noAllocation) {
      ref = this.allocate();
      this.entities[ref[0]].sids = [sid];
      this.sids.set(sid, ref);
    }
    return ref || null;
  }

  private getEntity(ref: EntityRef): Entity | null {
    if (!Array.isArray(ref)) return null;
    const [index, generation] = ref;
    const entity = this.entities[index];
    if (!entity || !entity.alive || entity.generation !== generation) {
      return null;
    }
    return entity;
  }

  private getComponentGenerationalArray<K extends keyof ComponentMapT>(componentName: string & K): GenerationalArray<ComponentMapT[K]> {
    let componentGenerationalArray = this.entityComponents[componentName] as GenerationalArray<ComponentMapT[K]>;
    if (!componentGenerationalArray) {
      componentGenerationalArray = new GenerationalArray<ComponentMapT[K]>();
      this.entityComponents[componentName] = componentGenerationalArray;
    }

    return componentGenerationalArray;
  }

  private genAddSidToEntity(entity: Entity, ref: EntityRef, assignedSid: Sid = null, makePrimary: boolean = false): Sid | null {
    const sid: Sid = assignedSid || randomStr();
    this.sids.set(sid, ref);
    if (makePrimary) {
      entity.sids.unshift(sid);
    } else {
      entity.sids.push(sid);
    }
    return sid;
  }
}

export default ECS;

interface Entity {
  generation: number;
  alive: boolean;
  sids: string[]; // first one as primary
}

export type EntityRef = [index: number, generation: number];

export const sidType = ss.string(); // serializable id
export type Sid = ss.Infer<typeof sidType>; // serializable id

class GenerationalArray<T> {
  array: T[] = [];
  generations: number[] = [];

  set(index: number, generation: number, value: T): void {
    this.array[index] = value;
    this.generations[index] = generation;
  }

  rm(index: number): void {
    delete this.array[index];
    delete this.generations[index];
  }

  get(index: number, generation: number): T | null {
    if (this.generations[index] !== generation) return null;
    return this.array[index] ?? null;
  }

  entries(): [index: number, generation: number, value: T][] {
    return this.array.map((value, index) => (
      [index, this.generations[index], value]
    ));
  }
}

export function entityEqual(e1: EntityRef, e2: EntityRef): boolean {
  return e1[0] === e2[0] && e1[1] === e2[1];
}

export class EntityComponents<ComponentMapT> {
  entity: EntityRef;
  private ecs: ECS<ComponentMapT>;

  constructor(entity: EntityRef, ecs: ECS<ComponentMapT>) {
    this.entity = entity;
    this.ecs = ecs;
  }

  get<K extends keyof ComponentMapT>(componentName: string & K): ComponentMapT[K] | null {
    return this.ecs.getComponent(this.entity, componentName);
  }

  set<K extends keyof ComponentMapT>(componentName: string & K, componentValue: ComponentMapT[K]): boolean {
    return this.ecs.setComponent(this.entity, componentName, componentValue);
  }
}
