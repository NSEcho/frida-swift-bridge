import { ContextDescriptorKind, TypeContextDescriptorFlags  } from "./metadatavalues";
import { RelativePointer } from "../lib/helpers";

export class TargetContextDescriptor {
    static readonly OFFSETOF_FLAGS = 0x0;

    #flags: number | undefined;

    constructor(protected handle: NativePointer) {
    }

    get flags(): number {
        if (this.#flags != undefined) {
            return this.#flags;
        }

        return this.handle.add(TargetContextDescriptor.OFFSETOF_FLAGS)
        .readU32();
    }

    getTypeKind(): ContextDescriptorKind {
        return this.flags & 0x1F;
    }
}

export class TargetTypeContextDescriptor extends TargetContextDescriptor {
    static readonly OFFSETOF_NAME = 0x8;

    #name: string | undefined;

    getTypeContextDescriptorFlags(): number {
        return (this.flags >>> 16) & 0xFFFF;
    }

    get name(): string {
        if (this.#name !== undefined) {
            return this.#name;
        }

        const namePtr = RelativePointer.resolveFrom(this.handle.add(
            TargetTypeContextDescriptor.OFFSETOF_NAME));
        return namePtr.readUtf8String();
    }
}

export class TargetClassDescriptor extends TargetTypeContextDescriptor {
    static readonly OFFSETOF_TARGET_VTABLE_DESCRIPTOR_HEADER = 0x2C;
    static readonly OFFSETOF_METHOD_DESCRIPTORS = 0x34;

    #methods: NativePointer[] | undefined;

    hasVTable(): boolean {
        return !!(this.getTypeContextDescriptorFlags() &
            (1 << TypeContextDescriptorFlags.Class_HasVTable));
    }

    getMethodDescriptors(): NativePointer {
        if (!this.hasVTable()) {
            return null;
        }

        return this.handle.add(TargetClassDescriptor.OFFSETOF_METHOD_DESCRIPTORS);
    }

    get methods(): NativePointer[] {
        if (this.#methods !== undefined) {
            return this.#methods;
        }

        if (!this.hasVTable()) {
            return [];
        }

        const result: NativePointer[] = [];
        const vtableHeaderPtr = this.handle.add(
            TargetClassDescriptor.OFFSETOF_TARGET_VTABLE_DESCRIPTOR_HEADER);
        const vtableHeader = new VTableDescriptorHeader(vtableHeaderPtr);
        const vtableSize = vtableHeader.vtableSize;

        /* 4 is word size, so we assume 64-bit systems only for now */
        let i = this.getMethodDescriptors();
        const end = i.add(vtableSize * TargetMethodDescriptor.sizeof);

        for (; !i.equals(end); i = i.add(TargetMethodDescriptor.sizeof)) {
            const methodDescriptor = new TargetMethodDescriptor(i);
            result.push(methodDescriptor.impl);
        }

        return result;
    }
}

class VTableDescriptorHeader {
    static readonly OFFSETOF_VTABLE_OFFSET = 0x0;
    static readonly OFFSETOF_VTABLE_SIZE = 0x4;

    #vtableSize: number | undefined;
    #vtableOffset: number | undefined;

    constructor(private handle: NativePointer) {
    }

    get vtableSize(): number {
        if (this.#vtableSize !== undefined) {
            return this.#vtableSize;
        }

        return this.handle.add(VTableDescriptorHeader.OFFSETOF_VTABLE_SIZE)
            .readU32();
    }
}

class TargetMethodDescriptor {
    static readonly OFFSETOF_FLAGS = 0x0;
    static readonly OFFSETOF_IMPL = 0x4;
    static sizeof = 8;

    #flags: number | undefined;
    #impl: NativePointer | undefined;

    constructor(private handle: NativePointer) {
    }

    get flags(): number {
        if (this.#flags !== undefined) {
            return this.#flags;
        }

        return this.handle.add(TargetMethodDescriptor.OFFSETOF_FLAGS).readU32();
    }

    get impl(): NativePointer {
        if (this.#impl !== undefined) {
            return this.#impl;
        }

        const pointer = this.handle.add(TargetMethodDescriptor.OFFSETOF_IMPL);
        return RelativePointer.resolveFrom(pointer);
    }
}

export class TargetStructDescriptor extends TargetTypeContextDescriptor {
    static readonly OFFSETOF_NUM_FIELDS = 0x18;
    static readonly OFFSETOF_FIELD_OFFSET_VECTOR_OFFSET = 0x1C;

    #numFields: number | undefined;
    #fieldOffsetVectorOffset: number | undefined;

    hasFieldOffsetVector(): boolean {
        return this.fieldOffsetVectorOffset !== 0;
    }

    get numFields(): number {
        if (this.#numFields !== undefined) {
            return this.#numFields;
        }

        return this.handle.add(TargetStructDescriptor.OFFSETOF_NUM_FIELDS)
            .readU32();
    }

    get fieldOffsetVectorOffset(): number {
        if (this.#fieldOffsetVectorOffset !== undefined) {
            return this.#fieldOffsetVectorOffset;
        }

        return this.handle.add(
            TargetStructDescriptor.OFFSETOF_FIELD_OFFSET_VECTOR_OFFSET).readU32();
    }
}
