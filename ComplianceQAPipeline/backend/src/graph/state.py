import operator
from typing import Annotated , List , Dict , Optional , Any , TypedDict

#define the schema for a single compliance result

#error report
class ComplianceIssue(TypedDict):
    category: str
    description : str # specific detail of vialtion
    severity : str #critical / warning
    timestamp : Optional[str]

#define the global graph state
#this defines the state that gets passed around in the agentic workflow

class VideoAuditState(TypedDict):
    '''
    defining the data schema fro langgraoh execution content, holds information about the audit right from the initial url to the final report
    '''

    # input parameters
    video_url : str 
    video_id : str

    #ingestion and extraction data
    local_file_path : Optional[str]
    video_metadata : Dict[str , Any]
    transcript : Optional[str] #fully speech to text
    ocr_text : List[str]

    #analysis output
    #stores the list of all the violation found by ai
    compliance_results : Annotated[List[ComplianceIssue],operator.add]

    #final_deliverables
    final_status : str # pass/fail
    final_report : str #markdown format

    #system observability
    #errors liek api timeout , sysyem level errors
    # list of system level crashes
    errors : Annotated[List[str] , operator.add]