import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WorkflowController} from "../controller/workflow.controller";
import { WorkflowsService} from "../service/workflow.service";

@Module({
    imports: [HttpModule],
    controllers: [WorkflowController],
    providers: [WorkflowsService],
    exports: [WorkflowsService],
})
export class WorkflowModule {}