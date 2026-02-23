<template>
    <Dialog v-model:open="open">
        <DialogContent class="max-w-[450px] bg-[#252526] border-gray-700 text-gray-200">
            <DialogHeader>
                <DialogTitle>Rename Item</DialogTitle>
            </DialogHeader>

            <div class="space-y-2">
                <Label>New Name</Label>
                <Input v-model="newName" @keyup.enter="rename" autofocus />
            </div>

            <DialogFooter>
                <Button variant="secondary" size="sm" @click="open = false">Cancel</Button>
                <Button size="sm" @click="rename">Rename</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const props = defineProps({
    file: { type: Object, required: true }
});

const emit = defineEmits(['close', 'rename']);

const open = ref(true);
const newName = ref(props.file?.name ?? '');

watch(open, (v) => { if (!v) emit('close'); });

const rename = () => {
    if (!newName.value) return;
    emit('rename', { file: props.file, newName: newName.value });
};
</script>
