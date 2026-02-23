<template>
    <Dialog v-model:open="open">
        <DialogContent class="max-w-[400px] bg-[#252526] border-gray-700 text-gray-200">
            <DialogHeader>
                <DialogTitle>New Folder</DialogTitle>
            </DialogHeader>

            <div class="space-y-2">
                <Label>Folder Name</Label>
                <Input v-model="folderName" placeholder="Enter folder name" @keyup.enter="create" autofocus />
            </div>

            <DialogFooter>
                <Button variant="secondary" size="sm" @click="open = false">Cancel</Button>
                <Button size="sm" @click="create">Create</Button>
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

const emit = defineEmits(['close', 'create']);

const open = ref(true);
const folderName = ref('');

watch(open, (v) => { if (!v) emit('close'); });

const create = () => {
    if (!folderName.value) return;
    emit('create', folderName.value);
};
</script>
